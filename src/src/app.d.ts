/// <reference types="@sveltejs/kit" />

declare global {
	namespace App {
		interface Error {
			message: string;
		}
		interface Locals {}
		interface PageData {
			content?: string;
			slug?: string;
		}
		interface PageState {}
		interface Platform {}
	}
}

export {};
