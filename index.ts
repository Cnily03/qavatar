import config from "@config"
import app from "@/index";

const PORT = config.port || 3000;

export default {
    port: PORT,
    fetch: app.fetch
}

console.info(`Listening on port http://localhost:${PORT}`);
