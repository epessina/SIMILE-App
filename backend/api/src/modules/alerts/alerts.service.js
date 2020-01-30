import Alert from "./alerts.model";
import { constructError } from "../../utils/construct-error";
import { removeFile } from "../../utils/utils";


/**
 * Retrieves all the alerts in the database.
 *
 * @param {Object} filter - The filter to apply to the query.
 * @param {Object} projection - The projection to apply to the query.
 * @param {Object} options - The options of the query.
 * @returns {Promise<Alert[]>} A promise containing the result of the query.
 */
export async function getAll(filter, projection, options) {

    return Alert.find(filter, projection, { lean: true, ...options });

}


/**
 * Retrieves the alert with the given id.
 *
 * @param {string} id - The id of the alert.
 * @param {Object} filter - Any additional filters to apply to the query.
 * @param {Object} projection - The projection to apply to the query.
 * @param {Object} options - The options of the query.
 * @returns {Promise<Alert>} A promise containing the result of the query.
 */
export async function getById(id, filter, projection, options) {

    // Find the data
    const alert = await Alert.findOne({ _id: id, ...filter }, projection, { lean: true, ...options });

    // If no data is found, throw an error
    if (!alert) throw constructError(404);

    // Return the data
    return alert;

}


/**
 * Creates a new alert and saves it in the database.
 *
 * @param {Object} data - The event data.
 * @returns {Promise<Alert>} A promise containing the newly created alert.
 */
export async function create(data) {

    // Create the new alert
    const alert = new Alert({
        uid       : data.uid,
        titleIta  : data.titleIta,
        titleEng  : data.titleEng,
        contentIta: data.contentIta,
        contentEng: data.contentEng,
        dateStart : data.dateStart,
        dateEnd   : data.dateEnd,
        rois      : data.rois,
    });

    // If the event id is provided, set it
    if (data.id) alert._id = data.id;

    // Save the alert
    return alert.save();

}


/**
 * Update an existing alert.
 *
 * @param {string} id - The id of the alert.
 * @param {Object} data - The new data.
 * @returns {Promise<{newAlert: Alert, created: boolean}>} A promise containing the created or updated alert and a flag
 *          stating if the alert has been created.
 */
export async function update(id, data) {

    // Find the alert
    const alert = await Alert.findById(id);

    // If no data is found, throw an error
    if (!alert) return { newAlert: await create({ id: id, ...data }), created: true };

    // Update the values
    alert.titleIta   = data.titleIta;
    alert.titleEng   = data.titleEng;
    alert.contentIta = data.contentIta;
    alert.contentEng = data.contentEng;
    alert.dateStart  = data.dateStart;
    alert.dateEnd    = data.dateEnd;
    alert.rois       = data.rois;

    // Save the alert
    return { newAlert: await alert.save(), created: false };

}


/**
 * Patch an existing alert.
 *
 * @param {string} id - The id of the alert.
 * @param {Object} data - The new data.
 * @returns {Promise<Alert>} A promise containing the patched alert.
 */
export async function patch(id, data) {

    // Find the alert
    const alert = await Alert.findById(id);

    // If no data is found, throw an error
    if (!alert) throw constructError(404);

    // If dateEnd property id less than dateStart, throw an error
    if (data.dateEnd && new Date(data.dateEnd).getTime() <= new Date(alert.dateStart).getTime())
        throw constructError(422, "Property 'dateEnd' must be grater than property 'dateStart'.");

    // Change the value of the given properties
    for (const k of Object.keys(data)) alert[k] = data[k];

    // Return the new alert
    return await alert.save();

}


/**
 * Set an alert as marked for deletion.
 *
 * @param {string} id - The id of the alert.
 * @returns {Promise<void>} - An empty promise.
 */
export async function softDelete(id) {

    // Find the event
    const alert = await Alert.findOne({ _id: id, markedForDeletion: false });

    // If no data is found, throw an error
    if (!alert) throw constructError(404);

    // Mark the survey for deletion
    alert.markedForDeletion = true;

    // Save the change
    await alert.save();

}
