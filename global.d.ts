interface EnvHono<T extends import("hono/types").Variables = {}> {
    Bindings: Env;
    Variables: T;
}