export interface SiteConfig<T extends string = string> {
    /**
     * The parameter name of the cipher text.
     * @default 'C'
     */
    cipher_param?: string;
    /**
     * The parameter name of the signature.
     * @default 'S'
     */
    sign_param?: string;
    /**
     * The parameter name of the user identifier.
     * @default 'uin'
     */
    uin_param?: T;
    /**
     * The extra query parameters to ignore when mixing the request parameters (value of `uin_param` will always be ignored).
     * @default ['t', '_']
     */
    ignore_params?: string[];
    /**
     * The header name to pass extra query parameters.
     */
    extra_param_header?: string;
    /**
     * AES key used to encode and decode the URL parameters.
     */
    aes_key: string;
    /**
     * AES IV used to encode and decode the URL parameters.
     */
    aes_iv: string;
    /**
     * XOR key used to encode and decode the URL parameters.
     */
    xor_key: number[];
}

export interface ProxyConfig<T extends string = string> {
    /**
     * The base URL as the target of the proxy server.
     */
    base_url?: string;
    /**
     * The default search query string of `base_url`.
     */
    default_search?: string;
    /**
     * The parameter name of the Tencent user identifier.
     */
    uin_param?: T;
}

export interface LicenseConfig {
    id: string;
    key: string;
    /**
     * Used to generate a signature for the request.
     */
    secret: string;
    /**
     * The policy to treat URL parameters except for the `cipher_param`, `sign_param`.
     * The extra parameters (except for `tencent_uin_param`) will be passed to the proxy server.
     * - `ignore`: Ignore the extra parameters.
     * - `deny`: Deny the request if there are extra parameters.
     * - `allow`: Allow the extra parameters that doesn't contains in important materials.
     * - `overwrite`: Allow the extra parameters which will overwrite the parameters in important materials.
     * @default 'ignore'
     */
    extra_param_policy?: 'ignore' | 'deny' | 'allow' | 'overwrite';
    /**
     * The policy to specify which parameters are used to generate the signature.
     * - `uin`: Only use the value of `uin_param` to generate the signature.
     * - `important`: Use mertials with important data for `cipher_param` to generate the signature.
     * - `all`: Use all parameters (in cipher parameters and in extra parameters) to generate the signature.
     * @default 'important'
     */
    sign_policy?: 'uin' | 'important' | 'all';
}

/**
 * HTTP Authentication to use `sign` API.
 */
export interface AuthenticationConfig {
    token: string;
    permissions?: {
        /**
         * License allowed to take.
         * @default []
         */
        allow_license?: string[];
    }
}

export interface GlobalConfig {
    /**
     * The port to listen to (not for cloudflare workers).
     * @default 3000
     */
    port?: number;
    site: SiteConfig;
    proxy?: ProxyConfig;
    license?: LicenseConfig[];
    authentication?: AuthenticationConfig[];
}

const default_site_config: Partial<SiteConfig> = {
    cipher_param: 'C',
    sign_param: 'S',
    uin_param: 'uin',
    ignore_params: ['t', '_'],
    extra_param_header: 'X-Form-Extra',
}

const default_proxy_config: Partial<ProxyConfig> = {
    base_url: "https://thirdqq.qlogo.cn/headimg_dl",
    default_search: 'spec=640&img_type=jpg',
    uin_param: 'dst_uin',
}

const default_license_config: Partial<LicenseConfig> = {
    extra_param_policy: 'ignore',
    sign_policy:'important',
}

export function defineConfig(config: GlobalConfig) {
    const conf = Object.assign({}, config);

    conf.site = Object.assign({}, default_site_config, config.site);

    conf.proxy = Object.assign({}, default_proxy_config, config.proxy);

    if (!config.license) config.license = [];
    conf.license = config.license.map(license => Object.assign({}, default_license_config, license));

    if (!config["authentication"]) config["authentication"] = [];
    conf["authentication"] = config["authentication"].map(auth => {
        if (!auth.permissions) auth.permissions = {};
        if (!auth.permissions.allow_license) auth.permissions.allow_license = [];
        return auth;
    });
    return conf;
}