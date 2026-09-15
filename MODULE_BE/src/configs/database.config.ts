import { registerAs } from "@nestjs/config";
// registerAs is a function that is used to register a configuration object
export default registerAs('database', () => ({
    mongodbUri: process.env.MONGODB_URI ,
    minPoolSize: 5,
    maxPoolSize: 20,
    maxIdleTimeMS: 30000, //30 seconds
    serverSelectionTimeoutMS: 10000, //10 seconds,
    retryAttempts: 3,
    retryDelay: 3000,
}))