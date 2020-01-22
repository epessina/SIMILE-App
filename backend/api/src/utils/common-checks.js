import mongoose from "mongoose";

import { validationResult } from "express-validator";
import { constructError } from "./construct-error";


/**
 * Checks if the user is authorized to perform the request.
 *
 * @param {Object} req - The Express request object.
 * @param {Function} next - The Express next middleware function.
 * @param {string | null} [userId=null] - The idValidation of the user to check.
 * @returns {boolean} The result of the check.
 */
export const checkIfAuthorized = (req, next, userId) => {

    if (req.isAdmin || req.userId === userId) return true;

    next(constructError(401));

    return false;

};


/**
 * Checks if a user has the rights to modify a resource.
 *
 * @param {Object} req - The Express request object.
 * @param {string} resUId - The idValidation of the user to check.
 * @returns {Error | null} An unauthorized error.
 */
export const checkModRights = (req, resUId) => {

    if (!req.isAdmin && req.userId !== resUId) return constructError(401);

};


/**
 * Checks if the validation of the body of a request presents errors.
 *
 * @param {Object} req - The Express request object.
 * @param {Function} next - The Express next middleware function.
 * @returns {boolean} The result of the check.
 */
export const checkValidation = (req, next) => {

    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        next(constructError(422, errors.errors[0].msg));
        return false;
    }

    return true;

};
