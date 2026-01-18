import {Volunteer} from "@/util/Volunteer";
import {generateParams} from "@/app/login/adminpage/generateParams";

export const baseURL = () : string => {
    return `${window.location.protocol}//${window.location.host}`;
}

export const generateURL = (formData: Volunteer): string => {
    const baseUrl = `${window.location.protocol}//${window.location.host}`;
    const path = 'verify'
    return `${baseUrl}/${path}?${generateParams(formData)}`;
};