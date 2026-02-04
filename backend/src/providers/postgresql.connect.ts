import { Pool } from 'pg'
import { DB_USER, DB_HOST, DB_NAME, DB_PASSWORD, DB_PORT } from '../config/env'
const pool = new Pool({
    user: DB_USER,
    host: DB_HOST,
    database: DB_NAME,
    password: DB_PASSWORD,
    port: parseInt(DB_PORT!),
    ssl: {
        rejectUnauthorized: false
    }
})

export default pool