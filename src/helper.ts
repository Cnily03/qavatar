import config from "@config";
import { HTTPException } from "hono/http-exception";
import type { LicenseConfig, AuthenticationConfig } from "@/config";
import { error_json, HTTPJsonException, JSON_sort_stringfy } from "@/utils";
import { encode_cipher, sign } from "@/crypto";

export type RequestArgs<T = {}> = Record<string, any> & T;
export type InUinRequestArgs = { [k: NonNullable<typeof config.site.uin_param>]: string } & RequestArgs;
export type OutUinRequestArgs = { [k: NonNullable<NonNullable<typeof config.proxy>["uin_param"]>]: string } & RequestArgs;

export const LicenseMap = new Map<string, LicenseConfig>();
for (const license of config.license || []) {
    LicenseMap.set(license.id, license);
}

export const AuthenticationMap = new Map<string, AuthenticationConfig>();
for (const auth of config.authentication || []) {
    AuthenticationMap.set(auth.token, auth);
}

/**
 * Mixin extra parameters to the `materials` according to the policy.
 */
export function mixin_extra_params(
    materials: InUinRequestArgs,
    extra: RequestArgs | undefined,
    policy: Required<LicenseConfig>["extra_param_policy"]
): OutUinRequestArgs {
    const uin_param = config.site.uin_param!;
    const proxy_uin_param = config.proxy!.uin_param!;

    materials = Object.assign({}, materials); // copy
    extra = Object.assign({}, extra); // copy

    // remove ignored params
    for (let param of config.site.ignore_params || []) {
        delete extra[param];
    }

    // replace uin_param
    let uin = materials[uin_param]
    if (typeof uin !== "string" && typeof uin !== "number") {
        throw new HTTPJsonException(400, `Invalid parameter: ${uin_param}: ${uin}`);
    }
    delete materials[uin_param];
    materials[proxy_uin_param] = uin;
    // mixin according to policy
    if (policy === "ignore") return materials;
    else if (policy === "deny") {
        if (typeof extra !== "undefined" && Object.keys(extra).length > 0) {
            throw new HTTPJsonException(400, `Extra parameters are not allowed.`);
        }
        return materials;
    } else if (policy === "allow") {
        return Object.assign({}, materials, extra, materials);
    } else if (policy === "overwrite") {
        return Object.assign({}, materials, extra, { [proxy_uin_param]: uin });
    }
    throw new Error(`Unexpected policy: ${policy}`);
}

/**
 * Collect the final request parameters passed to the proxy server.
 */
export function collect_search(mixins: OutUinRequestArgs): OutUinRequestArgs
export function collect_search(
    materials: InUinRequestArgs,
    extra: RequestArgs | undefined,
    extra_param_policy: Required<LicenseConfig>["extra_param_policy"]
): OutUinRequestArgs

export function collect_search(
    materials_or_mixins: InUinRequestArgs | OutUinRequestArgs,
    extra?: RequestArgs,
    extra_param_policy?: Required<LicenseConfig>["extra_param_policy"]
) {
    let mixins: OutUinRequestArgs;
    if (typeof extra_param_policy === "undefined") {
        mixins = materials_or_mixins as OutUinRequestArgs;
    } else {
        mixins = mixin_extra_params(materials_or_mixins as InUinRequestArgs, extra, extra_param_policy);
    }
    let defaults = Object.fromEntries(new URLSearchParams(config.proxy!.default_search!).entries())

    return Object.assign({}, defaults, mixins);
}

export function data_to_sign_with_policy(
    data: { materials: InUinRequestArgs, mixins: OutUinRequestArgs },
    sign_policy: Required<LicenseConfig>["sign_policy"]
) {
    if (sign_policy === "uin") {
        return JSON_sort_stringfy({ [config.site.uin_param!]: data.materials[config.site.uin_param!] })
    } else if (sign_policy === "important") {
        return JSON_sort_stringfy(data.materials)
    } else if (sign_policy === "all") {
        return JSON_sort_stringfy(data.mixins)
    } else {
        throw new Error(`Unexpected sign policy: ${sign_policy}`);
    }
}

export function collect_sign(
    license: LicenseConfig,
    materials: InUinRequestArgs,
    mixins: OutUinRequestArgs,
): { cipher: string, sign: string };
export function collect_sign(
    license: LicenseConfig,
    materials: InUinRequestArgs,
    extra: RequestArgs | undefined,
    extra_param_policyy: Required<LicenseConfig>["extra_param_policy"],
): { cipher: string, sign: string };
export function collect_sign(
    license: LicenseConfig,
    materials: InUinRequestArgs,
    extra_or_mixins: OutUinRequestArgs | RequestArgs | undefined,
    extra_param?: Required<LicenseConfig>["sign_policy"] | Required<LicenseConfig>["extra_param_policy"],
) {

    materials = Object.assign({}, materials); // copy

    let mixins_data: OutUinRequestArgs;
    type ExtraParamPolicy = Required<LicenseConfig>["extra_param_policy"];

    if (typeof extra_param === "undefined") {
        mixins_data = extra_or_mixins as OutUinRequestArgs;
    } else {
        let extra = Object.assign({}, extra_or_mixins); // copy
        let extra_param_policy = extra_param as ExtraParamPolicy;
        mixins_data = mixin_extra_params(materials, extra, extra_param_policy);
    }

    // sign
    const cipher = encode_cipher(JSON.stringify(materials))
    let sign_data = data_to_sign_with_policy({ materials, mixins: mixins_data }, license.sign_policy!);
    const signature = sign(sign_data, license.secret);

    return {
        license_id: license.id,
        cipher: cipher,
        sign: signature,
    }
}

export function collect_all(
    license: LicenseConfig,
    materials: InUinRequestArgs,
    extra: RequestArgs | undefined,
) {

    let ignored: Record<string, any> = {};
    if (typeof extra !== "undefined") {
        for (let key in extra) {
            if (config.site.ignore_params?.includes(key)) {
                ignored[key] = extra[key];
            }
        }
    }

    let mixins = mixin_extra_params(materials, extra, license.extra_param_policy!);
    let sign_result = collect_sign(license, materials, mixins)
    let final_search_json = collect_search(mixins);

    return {
        license_id: license.id,
        search: {
            material: materials,
            extra: extra || {},
            ignored: ignored,
            mixin: mixins,
            final: final_search_json
        },
        cipher: sign_result.cipher,
        sign: sign_result.sign
    }
}