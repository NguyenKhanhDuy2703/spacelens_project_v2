import { registerAs } from "@nestjs/config"; 

export default registerAs('app', () => ({
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    prefixApi: process.env.PREFIX_API || 'api',
    swaggerPath: process.env.SWAGGER_PATH || 'docs',
}))