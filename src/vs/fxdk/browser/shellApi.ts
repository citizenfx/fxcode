export interface IShellApi {
	events: {
		on<T>(eventName: string, listener: (data?: T) => void | Promise<void>): () => void;
		emit<T>(eventName: string, data?: T): Promise<void>;
	}
}

export type IWindowWithShellApi = (typeof window) & { shellApi: IShellApi };

export function getShellApi(): IShellApi {
	return (<IWindowWithShellApi>window.top!).shellApi;
}