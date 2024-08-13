import { Buffer } from 'node:buffer';
import crypto from 'node:crypto';
import config from '@config';

function padPKCS7(data: Buffer, blockSize: number) {
    let pad = Buffer.alloc(blockSize - data.length % blockSize, blockSize - data.length % blockSize);
    return Buffer.concat([data, pad]);
}

function digit_letter(len: number) {
    if (len <= 0) return '';
    let result = '';
    for (let i = 0; i < len; i++) {
        let n = Math.floor(Math.random() * 36 + 26)
        if (n < 36) result += n.toString(36);
        else result += String.fromCharCode(n + 29);
    }
    return result;
}

const AES_KEY = padPKCS7(Buffer.from(config.site.aes_key), 16);
const AES_IV = padPKCS7(Buffer.from(config.site.aes_iv), 16);

const XOR_KEY = Buffer.from(config.site.xor_key);

function xor(data: Buffer, key: Buffer) {
    let result = Buffer.alloc(data.length);
    for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ key[i % key.length];
    }
    return result;
}

function URLBase64Encode(data: Buffer) {
    return data.toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_')
        .replace(/=+$/, '');
}

function URLBase64Decode(data: string) {
    return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// sha1(data ^ salt) ^ xor_key + salt ^ xor_key + aes(data ^ xor_key) ^ salt
export function encode_cipher(data: string) {
    let salt_buf = crypto.randomBytes(4);
    let sha1_buf = crypto.createHash('sha1')
        .update(xor(Buffer.from(data), salt_buf)).digest();
    const aes_cipher = crypto.createCipheriv('aes-128-cbc', AES_KEY, AES_IV)
    let c1 = aes_cipher.update(xor(Buffer.from(data), XOR_KEY)), c2 = aes_cipher.final();
    let aes_buf = Buffer.concat([c1, c2]);
    const cipher = Buffer.concat([xor(sha1_buf, XOR_KEY), xor(salt_buf, XOR_KEY), xor(aes_buf, salt_buf)]);
    return digit_letter(2) + URLBase64Encode(cipher);
}

export function decode_cipher(data: string) {
    let cipher = URLBase64Decode(data.substring(2));
    let enc_sha1_buf = cipher.subarray(0, 20);
    let enc_salt_buf = cipher.subarray(20, 24);
    let enc_aes_buf = cipher.subarray(24);
    let sha1_buf = xor(enc_sha1_buf, XOR_KEY);
    let salt_buf = xor(enc_salt_buf, XOR_KEY);
    let aes_buf = xor(enc_aes_buf, salt_buf);
    const aes_cipher = crypto.createDecipheriv('aes-128-cbc', AES_KEY, AES_IV)
    let c1 = aes_cipher.update(aes_buf), c2 = aes_cipher.final();
    let data_buf = xor(Buffer.concat([c1, c2]), XOR_KEY);
    let sha1 = crypto.createHash('sha1')
        .update(xor(data_buf, salt_buf)).digest();
    if (sha1_buf.compare(sha1) !== 0) {
        throw new Error('Invalid cipher');
    }
    return data_buf.toString();
}

export function sign(data: string, secret: string) {
    const hmac_buf = crypto.createHmac('sha256', secret).update(data).digest();
    let hex = Array.from(hmac_buf.toString('hex').matchAll(/.{2}/g)).map((x) => x[0]);
    let num = hex.map((x) => parseInt(x, 16) % 62);
    let ch = num.map((x) => x < 36 ? x.toString(36) : String.fromCharCode(x + 29));
    let base62 = ch.join('');
    return base62.slice(0, 2) + URLBase64Encode(hmac_buf);
}

export function verify_sign(data: string, secret: string, signature: string) {
    return sign(data, secret) === signature;
}

