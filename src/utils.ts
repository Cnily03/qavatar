import { HTTPException } from "hono/http-exception";
import { StatusCode } from "hono/utils/http-status";

export function error_json(code: number, message: string) {
    return {
        code: code,
        message: message
    }
}

const STATUS_CODES = [
    100, 101, 102, 103,
    200, 201, 202, 203, 204, 205, 206, 207, 208, 226,
    305, 306,
    300, 301, 302, 303, 304, 307, 308,
    400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414, 415, 416, 417, 418, 421, 422, 423, 424, 425, 426, 428, 429, 431, 451,
    500, 501, 502, 503, 504, 505, 506, 507, 508, 510, 511
]

export class HTTPJsonException extends HTTPException {
    constructor(code: number, message: string, status?: StatusCode) {
        if (typeof status === "undefined") {
            if (STATUS_CODES.includes(code)) status = code as StatusCode;
            else status = 500;
        }
        super(status, {
            res: Response.json(
                error_json(code, message)
            )
        });
    }
}

export function JSON_sort_stringfy(obj: any) {
    function all_sorted_key(o: any) {
        let keys: string[] = [];

        function binary_insert(array: string[], value: any) {
            let L = 0, R = array.length;
            while (L < R) {
                let mid = (L + R) >>> 1;
                if (array[mid] < value) L = mid + 1;
                else R = mid;
            }
            array.splice(L, 0, value);
        }

        function recurse(cur_o: any) {
            for (const key in cur_o) {
                if (cur_o.hasOwnProperty(key)) {
                    binary_insert(keys, key.toString());
                    if (typeof cur_o[key] === 'object' && cur_o[key] !== null) {
                        recurse(cur_o[key]);
                    }
                }
            }
        }

        recurse(o);
        return keys;
    }

    return JSON.stringify(obj, all_sorted_key(obj));
}
