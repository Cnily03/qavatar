import config from '@config';
import { Hono, type Context } from 'hono';
import { HTTPException } from "hono/http-exception";
import { bearerAuth } from 'hono/bearer-auth'
import { encode_cipher, decode_cipher, sign, verify_sign } from '@/crypto';
import { LicenseMap, AuthenticationMap, mixin_extra_params, collect_search, collect_sign, type InUinRequestArgs, data_to_sign_with_policy, collect_all } from '@/helper';
import { error_json, HTTPJsonException, JSON_sort_stringfy } from '@/utils';

interface Variables {
	auth_token?: string;
	license_id?: string;
}

const app = new Hono<EnvHono<Variables>>();

const requireAuth = bearerAuth({
	verifyToken(token, c) {
		c.header("Content-Type", "text/plain");
		const q_license = c.req.query("license");
		if (typeof q_license !== "string") return false;

		const auth = AuthenticationMap.get(token);
		if (typeof auth === "undefined") return false;

		let delimiter_pos = q_license.indexOf(":");
		if (delimiter_pos === -1) return false;

		const license_id = q_license.slice(0, delimiter_pos);
		const license_key = q_license.slice(delimiter_pos + 1);
		if (!auth.permissions!.allow_license!.includes(license_id)) return false;

		const license = LicenseMap.get(license_id);
		if (typeof license === "undefined") return false;

		if (license.key !== license_key) return false;

		c.set("auth_token", token);
		c.set("license_id", license_id);
		c.res.headers.delete("Content-Type");
		return true;
	}
})

/**
 * @note Please ensure authentication before calling this function.
 */
const prepare = async (c: Context<EnvHono<Variables>>) => {
	let materials = await body_json(c);
	const uin_param = config.site.uin_param!;
	if (!Object.prototype.hasOwnProperty.call(materials, uin_param)) {
		throw new HTTPJsonException(400, `Missing parameter: ${uin_param}`);
	}
	let extra_params = parse_extra_params(c);
	const license_id = c.get("license_id")!;
	const license_conf = LicenseMap.get(license_id)!;
	return {
		license: license_conf as Required<typeof license_conf>,
		materials,
		extra_params
	}
}

const body_json = (c: Context<EnvHono<Variables>>) => {
	let contentType = c.req.header("Content-Type");
	if (typeof contentType !== "string") {
		throw new Error("Content-Type is not provided");
	}
	if (/^application\/json(;.*)?$/i.test(contentType)) {
		return c.req.json();
	} else {
		return c.req.parseBody();
	}
}

const parse_extra_params = (c: Context<EnvHono<Variables>>) => {
	const header_name = config.site.extra_param_header;
	if (!header_name) return undefined
	const extra = c.req.header(header_name);
	if (typeof extra !== "string") return undefined;
	const extra_params = Object.fromEntries(new URLSearchParams(extra).entries());
	return extra_params;
}

app.get("/avatar",
	async (c) => {
		const license_id = c.req.query("license");
		const cipher = c.req.query(config.site.cipher_param!);
		const sign = c.req.query(config.site.sign_param!);
		// ensure parameters provided
		if (typeof license_id !== "string" ||
			typeof cipher !== "string" ||
			typeof sign !== "string") {
			throw new HTTPException(400, { message: "Missing parameter" });
		}
		// verify license
		const license = LicenseMap.get(license_id);
		if (typeof license === "undefined") {
			throw new HTTPException(403, { message: "Invalid license" });
		}
		// get materials object
		let materials: InUinRequestArgs;
		try {
			materials = JSON.parse(decode_cipher(cipher))
			if (!Object.prototype.hasOwnProperty.call(materials, config.site.uin_param!)) {
				throw new Error();
			}
		} catch (e) { throw new HTTPException(403, { message: "Forbidden" }) }
		// get extra_params
		let extra_params = Object.assign({}, c.req.query());
		delete extra_params[config.site.cipher_param!];
		delete extra_params[config.site.sign_param!];
		delete extra_params["license"];
		// verify sign
		let mixins = mixin_extra_params(materials, extra_params, license.extra_param_policy!);
		let sign_data = data_to_sign_with_policy({ materials, mixins: mixins }, license.sign_policy!);
		if (!verify_sign(sign_data, license.secret, sign)) {
			throw new HTTPException(403, { message: "Forbidden" });
		}
		// proxy
		let proxy_base_url = config.proxy!.base_url!
		const final_search_json = collect_search(mixins);
		let search = new URLSearchParams(final_search_json);
		let proxy_url_obj = new URL(proxy_base_url);
		proxy_url_obj.search = search.toString();
		let resp = fetch(proxy_url_obj.toString(), { redirect: "follow" });
		return resp;
	}
)

app.post("/avatar/collect",
	requireAuth,
	async (c) => {
		const { license, materials, extra_params } = await prepare(c);

		return c.json(
			collect_all(license, materials, extra_params)
		)
	}
)

app.post("/avatar/sign",
	requireAuth,
	async (c) => {
		const { license, materials, extra_params } = await prepare(c);

		return c.json(
			collect_sign(license, materials, extra_params, license.extra_param_policy)
		)
	}
)

app.post("/avatar/url",
	requireAuth,
	async (c) => {
		const { license, materials, extra_params } = await prepare(c);

		// const mixins = mixin_extra_params(materials, extra_params, license.extra_param_policy);
		const data = collect_all(license, materials, extra_params)

		const prefix = c.req.query("prefix") || "";
		let url_param = new URLSearchParams(Object.assign(
			data.search.ignored,
			data.search.mixin, {
			[config.site.cipher_param!]: data.cipher,
			[config.site.sign_param!]: data.sign,
			license: license.id
		}));

		return c.json({
			url: `${prefix}/avatar?${url_param.toString()}`
		})
	}
)

app.onError((e, c) => {
	if (e instanceof HTTPException) {
		return e.getResponse();
	}
	console.error(e);
	if (c.req.method === "GET") {
		return c.text("Internal Server Error", 500);
	} else {
		return c.json(error_json(500, "Internal Server Error"), 500);
	}
})

export default app;
