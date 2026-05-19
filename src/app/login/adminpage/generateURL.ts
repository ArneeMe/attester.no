import {Volunteer} from "@/util/Volunteer";
import {generateParams} from "@/app/login/adminpage/generateParams";

export const generateURL = (formData: Volunteer): string =>
    `${window.location.origin}/verify?${generateParams(formData)}`;