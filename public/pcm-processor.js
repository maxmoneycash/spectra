/**
 * PCM ring-buffer player. Receives Float32 audio chunks (48 kHz) from the main
 * thread over the message port and streams them to the output, emitting silence
 * on underrun rather than glitching. Kept as plain JS so it loads directly as an
 * AudioWorklet module.
 */
class PCMPlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.capacity = 48000 * 2; // 2 s ring
    this.buffer = new Float32Array(this.capacity);
    this.readPos = 0;
    this.writePos = 0;
    this.available = 0;
    this.port.onmessage = (e) => {
      const data = e.data;
      if (data === 'clear') {
        this.readPos = this.writePos = this.available = 0;
        return;
      }
      const chunk = data;
      for (let i = 0; i < chunk.length; i++) {
        this.buffer[this.writePos] = chunk[i];
        this.writePos = (this.writePos + 1) % this.capacity;
        if (this.available < this.capacity) {
          this.available++;
        } else {
          // Overflow: drop oldest.
          this.readPos = (this.readPos + 1) % this.capacity;
        }
      }
    };
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const frames = output[0].length;
    // Keep a small safety margin so we don't chase the writer.
    const canPlay = this.available > frames ? frames : 0;
    for (let i = 0; i < frames; i++) {
      let s = 0;
      if (i < canPlay) {
        s = this.buffer[this.readPos];
        this.readPos = (this.readPos + 1) % this.capacity;
        this.available--;
      }
      for (let ch = 0; ch < output.length; ch++) output[ch][i] = s;
    }
    return true;
  }
}

registerProcessor('pcm-player', PCMPlayer);
