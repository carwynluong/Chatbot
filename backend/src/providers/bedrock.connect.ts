import { BedrockRuntimeClient } from "@aws-sdk/client-bedrock-runtime"
import { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION } from "../config/env"

const bedrockClient = new BedrockRuntimeClient({
    region: AWS_REGION,
    credentials:{
        accessKeyId: AWS_ACCESS_KEY_ID!,
        secretAccessKey: AWS_SECRET_ACCESS_KEY!
    }
})

export default bedrockClient