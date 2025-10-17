// bridge_v2/audio.js — мост для аудио-записи
import { AudioRecorder } from '../modules/audio-recorder.js';

export class AudioBridgeV2 {
  constructor(widget) {
    this.rec = new AudioRecorder(widget);
  }

  start() { return this.rec.startRecording(); }
  cancel() { return this.rec.cancelRecording(); }
  stopAndSend() { return this.rec.finishAndSend(); }
  cleanupAfterSend() { return this.rec.cleanupAfterSend(); }
}


