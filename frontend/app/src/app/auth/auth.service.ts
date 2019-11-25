import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";

@Injectable({
    providedIn: 'root'
})
export class AuthService {

    private _isUserAuth: Boolean;
    private _userId: String;
    private _token: String;

    constructor(private http: HttpClient) {

        this.login();

    }

    get isUserAuth() { return this._isUserAuth }

    get userId() { return this._userId }

    get token() { return this._token }


    login() {

        this._isUserAuth = true;
        this._userId     = "5dd7bbe0701d5bdd685c1f18";
        this._token      = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI1ZGQ3YmJlMDcwMWQ1YmRkNjg1YzFmMTgiLCJpc0FkbWluIjoiZmFsc2UiLCJpYXQiOjE1NzQ0MTk0MjQsImV4cCI6MTY2MDgxOTQyNH0.BDS7n-kHgwgCj9c_--aShJ9cWoOe5a8QSM_5a7oM7V8";

    }

    // ToDo
    logout() {}

}
