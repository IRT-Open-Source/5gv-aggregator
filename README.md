| [![5G-VICTORI logo](doc/images/5g-victori-logo.png)](https://www.5g-victori-project.eu/) | This project has received funding from the European Union’s Horizon 2020 research and innovation programme under grant agreement No 857201. The European Commission assumes no responsibility for any content of this repository. | [![Acknowledgement: This project has received funding from the European Union’s Horizon 2020 research and innovation programme under grant agreement No 857201.](doc/images/eu-flag.jpg)](https://ec.europa.eu/programmes/horizon2020/en) |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |


# Aggregator

Aggregates content metadata and stream URLs from various sources.

## What is this?

The Aggregator service is part of the [platform](../../../5gv-platform) for media caching on trains. Based on given criteria, the Aggregator retrieves content metadata and resource locations of media items in video on demand (VoD) catalogues. Criteria are determined by a human user, e.g. editiorial staff of the VoD service, through a [user interface for configuration](../../../5gv-configurator-ui). For adaptive bitrate streams the Aggregator will retrieve locations of stream segements of all qualities. From all retrieved content information, the Aggregator compiles a list of media items, which it passes to the [State API](../../../5gv-state-api). The State API will initialise a new cache state, which is used to capture the caching status of the individual media items. The State API will than notify subscribers ([Cache Monitor](../../../5gv-cache-monitor) and [Prefetcher](../../../5gv-prefetcher)) that a new cache state has been instantiated.

## How does it work?

Below architecture diagram shows the software modules that implement the essential functionalities of the Aggregator. These include clients for HTTP communication with the [State API](../../../5gv-state-api) and communication with the [Message Streamer](../../../5gv-messenger). A core logic module, which is implemented in [`aggregator.service.ts`](src/aggregator/aggregator.service.ts), manages different [crawler modules](src/aggregator/crawler/), which search different sources for content according to the rules given in the configuration. Currently, two crawlers are implemented:

- [`ard-core-crawler.ts`](src/aggregator/crawler/ard-core-crawler/ard-core-crawler.ts): searches the ARD core database for the latest publications. **Note**: *the ARD-Core service is under constand development and not stable. Its API is subject to changes, the service does not always respond as documented and is sometimes not reachable at all.*
- [`ard-mediathek-crawler.ts`](src/aggregator/crawler/ard-mediathek-crawler/ard-mediathek-crawler.ts): searches the homepage of the ARD-Mediathek. It follows links on the home page, as well as links on the corresponding sub-pages, until the number of videos specified by the configuration rules is found. For this purpose the script parses the JSON files loaded by the ARD-Mediathek application. JSON files contain information about the playback media including descriptive meta data, as well as resource locations.

![Architecture of the Aggregator service](https://docs.google.com/drawings/d/1YGDOVR5jnQ_t7mS8U6Dmb-s_zItA-lqHfEbVapgCdj4/export/svg)

The basic program flow of the core logic in [aggregator.service.ts](src/aggregator/aggregator.service.ts) is as follows:

- Set listener for `'new-aggregator-config'` messages
- On reception of a `'new-aggregator-config'` message:
  - Cancel running crawl tasks
  - Load new configuration
  - Find information on media items that match configured rules (task of crawlers)
  - Remove duplicate media items
  - Remove stream URLs for unwanted video formats (currently only URLs to HLS streams are kept)
  - For each media item, parse the manifest file of adaptive bitrate streams (currently only HLS) and segement URLs to the list of stream URLs of the media item
  - Send list of media items to State API in order for it to instantiate a new cache state

## Technologie used

- [Nest.js](https://nestjs.com/)

## Adapt to other VoD-Services

At the moment the Aggregator is specialised to find content of the ARD-Mediathek. In order to adapt the Aggregator for other VoD services, appropriate crawlers must be implemented, which than need to be integrated in [`aggregator.service.ts`](src/aggregator/aggregator.service.ts) in order to serve a given configuration.

## Install, build, run

**Note:** *Typically you would use the `up.sh` script from the [Platform](../../../5gv-platform) project to install, build and run this service as part of a composite of docker services. Read on if you intend to run the service directly on your host system.*

**Prerequestits**: Following software needs to be installed on your host machine in order to execute the subsequent steps.

- [Node.js](https://nodejs.org/en/)
- [NPM](https://www.npmjs.com/)

First, `git clone` this project and change into its root directory. Than run the following command to install its dependencies:

```bash
$ npm install
```

You can than run the service in three different modes.

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

With following command you can build a [docker image](https://www.docker.com) for this service. But again, typically you use the startup script `up.sh` of the [Platform](../../../5gv-platform) project to do the job.

```bash
$ DOCKER_BUILDKIT=1 docker build --ssh gitlab="$HOME/.ssh/<<your_private_key_name>>" -t aggregator .
```

Replace `<<your_private_key_name>>` by the name of the private key used to authenticate at the repository.
