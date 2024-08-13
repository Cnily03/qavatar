import { defineConfig } from "@/config"

export default defineConfig({
    port: 3000,
    site: {
        aes_key: "123456789",
        aes_iv: "123456789",
        xor_key: [0xCF, 0xBA, 0x8D, 0x01],
        uin_param: "uin"
    },
    license: [{
        id: "test",
        key: "a9a6446b-2026-47e6-a4f8-e527822e0cac",
        secret: "secret_to_sign",
        extra_param_policy: "overwrite",
        sign_policy: "uin",
    }],
    authentication: [{
        token: "1087b044-e949-4955-8417-9b96e0892727",
        permissions: {
            allow_license: ["test"]
        }
    }]
})