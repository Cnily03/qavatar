# QAvatar

QQ Avatar API with signature.

## Getting Started

Install dependencies:

```shell
pnpm i && bun install
```

Start the server:

```shell
pnpm start # or `bun start`
```

### Get signed avatar URL

```http
POST /avatar/url?license=<license_id>:<license_key> HTTP/1.1
Authentication: Bearer <token>
X-Form-Extra: <extra_form_data>

<important_form_data>
```

You will get the URL of the avatar with your `<important_form_data>` encrypted. The URL contains encrypted data and signature, and the license ID. You can add query parameters to the URL and it will be injected into the URL which backend uses to fetch the avatar.

## License

Copyright (c) Cnily03. All rights reserved.

Licensed under the [MIT](./LICENSE) License.
