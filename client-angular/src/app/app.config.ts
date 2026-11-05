import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';

import { routes } from './app.routes';
import { appInterceptors } from './core/http/interceptors';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // withComponentInputBinding: route params (:id) and query params (?category=) arrive as component input()s
    provideRouter(routes, withComponentInputBinding()),
    // HttpClient on the browser's fetch, plus the Phase 6 interceptors (correlation id, auth, activity, errors)
    provideHttpClient(withFetch(), withInterceptors(appInterceptors)),
  ],
};
