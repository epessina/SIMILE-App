import { Injectable } from '@angular/core';
import { BehaviorSubject } from "rxjs";
import { HttpClient, HttpParams } from "@angular/common/http";
import cloneDeep from "lodash-es/cloneDeep";
import get from "lodash-es/get";
import { NGXLogger } from "ngx-logger";
import { LatLng } from "leaflet";

import { environment } from "../../environments/environment";
import { GenericApiResponse } from "../shared/utils.interface";
import { Observation } from "./observation.model";
import { ObsInfo } from "./info/obs-info.model";
import { ConnectionStatus, NetworkService } from "../shared/network.service";
import { OfflineService } from "./offline.service";
import { FileService } from "../shared/file.service";


export interface MinimalObservation {
    _id: string,
    // uid: string,
    position: { coordinates: Array<number>, roi?: string }
}


@Injectable({ providedIn: 'root' })
export class ObservationsService {

    private _obs = new BehaviorSubject<Array<MinimalObservation>>([]);

    public newObservation: Observation;

    get observations() { return this._obs.asObservable() }


    constructor(private http: HttpClient,
                private fileService: FileService,
                private networkService: NetworkService,
                private logger: NGXLogger,
                private offlineService: OfflineService) { }


    /** Retrieves all the observations from the server. */
    async fetchObservations(): Promise<void> {

        const url = `${ environment.apiBaseUrl }/${ environment.apiVersion }/observations`;

        const qParams = new HttpParams()
            .set("minimalRes", "true")
            .set("excludeOutOfRois", "true");

        const res = await this.http.get<GenericApiResponse>(url, { params: qParams }).toPromise();

        this._obs.next(res.data);

    }


    /**
     * Retrieves from the server the observation with the given id.
     *
     * @param {string} id - The id of the observation.
     * @return {Promise<ObsInfo>} A promise containing the observation.
     */
    async getObservationById(id: string): Promise<ObsInfo> {

        const url = `${ environment.apiBaseUrl }/${ environment.apiVersion }/observations/${ id }`;

        const res = await this.http.get<GenericApiResponse>(url).toPromise();

        const data = <ObsInfo>res.data;

        data.photos = data.photos.map(p => `${ environment.apiBaseUrl }/${ p }`);

        if (get(data, "details.outlets.signagePhoto"))
            data.details.outlets.signagePhoto = `${ environment.apiBaseUrl }/${ data.details.outlets.signagePhoto }`;

        return data;

    }


    /**
     * Calls the API to get the current weather data for a give point.
     *
     * @param {LatLng} coords - The coordinates of the point.
     * @returns {Promise<Object>} - The weather data.
     */
    async getWeatherData(coords: LatLng): Promise<{ sky: number, temperature: number, wind: number }> {

        const url = `${ environment.apiBaseUrl }/${ environment.apiVersion }/misc/weather`;

        const qParams = new HttpParams()
            .set("lat", coords.lat.toString())
            .set("lon", coords.lng.toString());

        const res = await this.http.get<GenericApiResponse>(url, { params: qParams }).toPromise();

        return res.data;

    }


    /**
     * Sends a new observation to the server.
     *
     * @return {Promise<"online" | "offline">} A promise containing the place where the observation has been stored.
     */
    async postObservation(): Promise<"online" | "offline"> {

        const cleanObs = this.cleanObservationFields();

        if (this.networkService.getCurrentNetworkStatus() === ConnectionStatus.Offline) {
            await this.offlineService.storeObservation(cleanObs);
            return "offline";
        } else {
            await this.sendObservation(cleanObs);
            return "online";
        }

    }


    /** Sends to the server all the locally saved observations. */
    async postStoredObservations(): Promise<void> {

        const savedObs = await this.offlineService.getStoredObservations();

        if (!savedObs || savedObs.length === 0) return;

        const pObs   = [];
        const errObs = [];

        savedObs.forEach(obs => {
            pObs.push(
                this.sendObservation(obs)
                    .then(() => {
                        this.logger.log("Observation correctly sent");
                        this.removeStoredObservationImages(obs);
                    })
                    .catch(err => {
                        this.logger.error("Error sending observation.", err);
                        errObs.push(obs)
                    })
            );
        });

        await Promise.all(pObs);

        await this.offlineService.storeObservations(errObs);

    }


    /**
     * Cleans the fields of the new observation, preparing it to be sent to the server.
     *
     * @return {Object} A cleaned copy of the new observation.
     */
    private cleanObservationFields(): any {

        const obs = <any>cloneDeep(this.newObservation);

        obs.position.coordinates = [obs.position.coordinates.lng, obs.position.coordinates.lat];

        Object.keys(obs.details).forEach(k => {

            if (!obs.details[k].checked) {
                delete obs.details[k];
                return;
            }

            delete obs.details[k].component;

            if (k === "odours" && obs.details[k].origin.length === 0) obs.details[k].origin = undefined;
            if (k === "litters" && obs.details[k].type.length === 0) obs.details[k].type = undefined;

            if (k === "fauna") {

                Object.keys(obs.details.fauna).forEach(f => {
                    if (obs.details.fauna[f].alien && obs.details.fauna[f].alien.species.length === 0)
                        obs.details.fauna[f].alien.species = undefined
                });

            }

        });

        if (Object.keys(obs.details).length === 0) delete obs.details;

        if (obs.measures) {

            Object.keys(obs.measures).forEach(k => {

                if (!obs.measures[k].checked) {
                    delete obs.measures[k];
                    return;
                }

                delete obs.measures[k].checked;
                delete obs.measures[k].component;

            });

        }

        return obs;

    }


    /**
     * Posts an observation to the server.
     *
     * @param {Object} obs - The observation to be posted.
     */
    private async sendObservation(obs: any): Promise<void> {

        const formData = await this.setRequestBody(obs);

        const url     = `${ environment.apiBaseUrl }/${ environment.apiVersion }/observations`;
        const qParams = new HttpParams().set("minimalRes", "true");

        const res = await this.http.post<GenericApiResponse>(url, formData, { params: qParams }).toPromise();

        const resData = <MinimalObservation>res.data;

        if (resData.position.roi)
            this._obs.next([...this._obs.value, resData]);

    }


    /**
     * Creates the body of a new observation post request.
     *
     * @param {Object} obs - The observation to post.
     * @return {Promise<FormData>} A promise containing the created form data.
     */
    private async setRequestBody(obs: any): Promise<FormData> {

        const formData = new FormData();

        for (let i = 0; i < obs.photos.length; i++) {

            console.log(obs.photos[i]);

            if (obs.photos[i]) {
                await this.fileService.appendImage(formData, obs.photos[i], "photos")
                    .catch(err => this.logger.error(`Error appending photo ${obs.photos[i]}.`, err));
            }

        }

        const outletPhoto = get(obs, "details.outlets.signagePhoto");

        if (outletPhoto) {

            await this.fileService.appendImage(formData, obs.details.outlets.signagePhoto, "signage")
                .catch(err => this.logger.error("Error appending signage photo.", err));

            obs.details.outlets.signagePhoto = undefined;

        }

        Object.keys(obs).forEach(k => {
            if (k === "photos") return;
            formData.append(k, JSON.stringify(obs[k]));
        });

        if (outletPhoto) obs.details.outlets.signagePhoto = outletPhoto;

        return formData;

    }


    /**
     * Removes all the images of an observation.
     *
     * @param {Object} obs - The observation.
     */
    async removeStoredObservationImages(obs: any): Promise<void> {

        for (let i = 0; i < obs.photos.length; i++) {

            if (obs.photos[i])
                await this.fileService.removeImage(obs.photos[i])
                    .catch(err => this.logger.error(`Error removing image ${obs.photos[i]}`, err));

        }

        const outletPhoto = get(obs, "details.outlets.signagePhoto");

        if (outletPhoto)
            await this.fileService.removeImage(outletPhoto)
                .catch(err => this.logger.error(`Error removing image ${outletPhoto}`, err));

    }


    /** Sets the new observation to null. */
    resetNewObservation(): void { this.newObservation = null }

}
