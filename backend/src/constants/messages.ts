import statusCodes from "./statusCodes"


const messages = {
    [statusCodes.OK]: "Request was successful.",
    [statusCodes.CREATED]: "Resource was created successfully.",
    [statusCodes.ACCEPTED]: "Request has been accepted for processing.",
    [statusCodes.NO_CONTENT]: "Request was successful but there's no content to return.",
    [statusCodes.BAD_REQUEST]: "The request could not be understood or was missing required parameters.",
    [statusCodes.UNAUTHORIZED]: "Authentication failed or user does not have permissions.",
    [statusCodes.FORBIDDEN]: "User does not have access to the requested resource.",
    [statusCodes.NOT_FOUND]: "The requested resource could not be found.",
    [statusCodes.METHOD_NOT_ALLOWED]: "The HTTP method used is not supported for this resource.",
    [statusCodes.CONFLICT]: "There was a conflict with the current state of the resource.",
    [statusCodes.INTERNAL_SERVER_ERROR]: "An error occurred on the server.",
    [statusCodes.SERVICE_UNAVAILABLE]: "The service is currently unavailable."
}


export default messages