# Solid Geoindex

This service keeps track of Things of specific type that have a location on Earth and belong to defined groups of people.

## How it works

- It's a bot agent with its own identity.
- It runs on a server.
- When you create, update or remove a Thing, you send a notification to this service's inbox. The service will fetch and save the Thing's uri and location.
- The service regularly crawls Things of its group members, and updates itself accordingly. (In case it missed a notification.)
- The group members can query the service for Things at certain geohash, using Triple Pattern Fragment (not fully compatible, yet).

## Usage

### Configure

Copy `.env.sample` to `.env` and edit the latter according to your needs.

_:warning: If you provide URIs with `#``, put them to `""`, otherwise # may be interpreted as comment!_

Alternatively, you may provide the configuration as environment variables

You can find full list of config options in [.env.sample](./.env.sample)

### Run

Install for production:

```sh
yarn install --frozen-lockfile --production
```

Run:

```sh
yarn start
```

### Use

Service API is documented in [OpenAPI schema](./apidocs/openapi.json) (still work in progress). When you run the app with `yarn start`, you'll see the Swagger-UI documentation at `/`.

## Tests

Install for development:

```sh
yarn install --frozen-lockfile
```

Run:

```sh
yarn test
```

Tests are placed in [src/test/](./src/test/)

## TODO

- [ ] remove stale accommodations after index updates, otherwise they may hang there forever
- [ ] maybe also validate and store the person, community, ... in the database. We may have index for multiple communities in the future.
- [ ] maybe configure the server by providing its webId - that will provide baseUrl, hash, path to webId.
- [ ] cache the groups, possibly with etags - they don't need to be fetched every time.

## Maybe

- [ ] index multiple communities, and show the results to particular community members only

## License

MIT
