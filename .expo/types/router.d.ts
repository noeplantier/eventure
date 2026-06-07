/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(auth)/welcome` | `/(organizer)` | `/(organizer)/applications` | `/(organizer)/create-event` | `/(organizer)/dashboard` | `/(staff)` | `/(staff)/earnings` | `/(staff)/feed` | `/(staff)/planning` | `/(staff)/profile` | `/_sitemap` | `/applications` | `/create-event` | `/dashboard` | `/earnings` | `/feed` | `/planning` | `/profile` | `/welcome`;
      DynamicRoutes: `/(organizer)/event/${Router.SingleRoutePart<T>}` | `/event/${Router.SingleRoutePart<T>}`;
      DynamicRouteTemplate: `/(organizer)/event/[id]` | `/event/[id]`;
    }
  }
}
