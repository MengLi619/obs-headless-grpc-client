import { credentials } from 'grpc';
import { StudioClient } from './models/studio_grpc_pb';
import { promisify } from 'util';
import { SceneAddRequest, SceneAddResponse, SceneSetAsCurrentRequest, ShowCreateRequest, ShowCreateResponse, SourceAddRequest } from './models/studio_pb';
import { Empty } from 'google-protobuf/google/protobuf/empty_pb';
import * as uuid from 'uuid';
import * as readline from 'readline';

interface Scene {
  id?: string;
  name: string;
  url: string;
}

const client: StudioClient = new StudioClient('localhost:50051', credentials.createInsecure(), {
  'grpc.keepalive_time_ms': 120000,
  'grpc.http2.min_time_between_pings_ms': 120000,
  'grpc.keepalive_timeout_ms': 20000,
  'grpc.http2.max_pings_without_data': 0,
  'grpc.keepalive_permit_without_calls': 1,
});

const createShow = promisify(client.showCreate).bind(client);
const addScene = promisify(client.sceneAdd).bind(client);
const addSource = promisify(client.sourceAdd).bind(client);
const startStudio =  promisify(client.studioStart).bind(client);
const sceneSetAsCurrent = promisify(client.sceneSetAsCurrent).bind(client);

let showId: string | undefined;
const scenes: Scene[] = [
  {
    name: 'scene-1',
    url: 'http://ivi.bupt.edu.cn/hls/cctv1hd.m3u8',
  },
  {
    name: 'scene-2',
    url: 'http://ivi.bupt.edu.cn/hls/cctv6hd.m3u8',
  }
];

async function main() {
  try {
    // Create show
    const showShowRequest = new ShowCreateRequest();
    showShowRequest.setShowName('show');
    const show = await createShow(showShowRequest) as ShowCreateResponse;
    showId = show.getShow()?.getId();

    // Create scenes
    for (const scene of scenes) {
      // Add scene
      const sceneAddRequest = new SceneAddRequest();
      sceneAddRequest.setShowId(showId as string);
      sceneAddRequest.setSceneName(scene.name);
      scene.id = (await addScene(sceneAddRequest) as SceneAddResponse).getScene()?.getId();

      // Add source
      const source1AddRequest = new SourceAddRequest();
      source1AddRequest.setShowId(showId as string);
      source1AddRequest.setSceneId(scene.id as string);
      source1AddRequest.setSourceName(uuid.v4());
      source1AddRequest.setSourceType('RTMP');
      source1AddRequest.setSourceUrl(scene.url);
      await addSource(source1AddRequest);
    }

    // Start studio
    await startStudio(new Empty());
  } catch (e) {
    console.error(e);
  }
}

main();

const readLine = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});

const color = (str: string | number) => `\x1b[35m${str}\x1b[0m`;

const question = (callback: (index: string) => Promise<void>) => {
  scenes.forEach((scene, index) => {
    readLine.write(`[${color(index)}] ${scene.name}\n`);
  })
  readLine.question('Which scene to switch?\n', async (index: string) => {
    try {
      if (index) {
        await callback(index);
      }
    } finally {
      question(callback);
    }
  });
};

question(async (index: string) => {
  const scene = scenes[Number(index)];
  const request = new SceneSetAsCurrentRequest();
  request.setShowId(showId as string);
  request.setSceneId(scene.id as string);
  await sceneSetAsCurrent(request);
});
