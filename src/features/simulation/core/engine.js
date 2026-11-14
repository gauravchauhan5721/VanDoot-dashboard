/**
 * Deterministic, browser-local demonstration engine. No hardware is contacted.
 * `online` means reachable over the modeled network, not necessarily unpowered.
 * Risk, AI, automatic failover and durable buffering are proposed capabilities.
 */
import { getMeshRoute, getMeshLinks } from './network.js';

export const FLOW_STEPS = Object.freeze([
  'Sensor acquisition',
  'Structured JSON',
  'painlessMesh → root',
  'mDNS / Avahi discovery',
  'HTTP POST → Raspberry Pi',
  'Flask API receives',
  'Backend processing',
  'Dashboard updated',
]);

export const SCENARIOS = Object.freeze([
  { id: 'normal', label: 'Normal forest', description: 'Follow a simulated reading from sensor to dashboard.', proposedOnly: false, icon: 'leaf' },
  { id: 'temperature', label: 'Rising temperature', description: 'Watch temperature rise while the other channels remain near baseline.', proposedOnly: false, icon: 'temperature' },
  { id: 'fire', label: 'Potential fire risk', description: 'Correlate rising temperature, falling humidity and elevated raw gas readings at several nodes. This is not fire confirmation.', proposedOnly: true, icon: 'fire' },
  { id: 'motion', label: 'PIR motion', description: 'Node 02 reports movement; a JSON packet follows the complete prototype path.', proposedOnly: false, icon: 'motion' },
  { id: 'human', label: 'Human detection', description: 'Demonstrate proposed PIR-triggered capture, transfer and simulated YOLO classification.', proposedOnly: true, icon: 'human' },
  { id: 'animal', label: 'Animal detection', description: 'Demonstrate proposed wildlife verification using an illustrative camera event.', proposedOnly: true, icon: 'animal' },
  { id: 'vehicle', label: 'Vehicle detection', description: 'Demonstrate a proposed vehicle classification and location-tagged event.', proposedOnly: true, icon: 'vehicle' },
  { id: 'unknown', label: 'Unknown object', description: 'Demonstrate an inconclusive camera result that remains unidentified and requires review.', proposedOnly: true, icon: 'unknown' },
  { id: 'wifi-failure', label: 'Wi-Fi failure', description: 'Remove the Wi-Fi uplink. Observe dropped prototype packets or proposed buffering.', proposedOnly: false, icon: 'wifi-off' },
  { id: 'lora-backup', label: 'LoRa backup', description: 'Lose Wi-Fi, then select an available SX1278 route after a simulated detection delay.', proposedOnly: true, icon: 'radio' },
  { id: 'node-failure', label: 'Sensor node failure', description: 'Make Node 02 unreachable; proposed mode demonstrates route repair and buffered replay.', proposedOnly: false, icon: 'node-off' },
  { id: 'gateway-failure', label: 'Gateway outage', description: 'Take the central ESP32 gateway offline and inspect the effect on delivery.', proposedOnly: false, icon: 'gateway' },
  { id: 'gateway-recovery', label: 'Gateway recovery', description: 'Restore connectivity and, in proposed mode, forward messages buffered during the outage.', proposedOnly: false, icon: 'recovery' },
  { id: 'low-battery', label: 'Low battery', description: 'Show an illustrative battery warning and proposed power-aware operation.', proposedOnly: true, icon: 'battery' },
]);

const LOCATIONS = [
  [-16, -9, 'North-west ridge'], [0, -15, 'Northern trail'], [15, -6, 'Eastern canopy'],
  [-20, 8, 'Western boundary'], [12, 15, 'Southern clearing'], [23, 5, 'East access road'], [-8, 18, 'River corridor'],
];
const STAGE_SECONDS = 0.62;
// Slowed for visible hop-by-hop teaching; not measured Wi-Fi or LoRa latency.
const MESH_HOP_SECONDS = 0.8;
// Allow the longest illustrative four-hop pipeline (7.54s) to drain before
// the next normal sample, so demo playback does not manufacture congestion.
const SAMPLE_SECONDS = 8;
const BUFFER_LIMIT = 48;
const round = (number, places = 1) => Number(number.toFixed(places));
const clamp = (number, min = 0, max = 1) => Math.max(min, Math.min(max, number));

function nodesFor(phase) {
  return LOCATIONS.slice(0, phase === 'prototype' ? 3 : 7).map(([x, z, location], index) => ({
    id: `n${index + 1}`, name: `Node ${String(index + 1).padStart(2, '0')}`, x, z, location,
    temp: round(28.5 + index * 0.2), humidity: 65 - index, gas: 120 + index * 5,
    motion: false, online: true, battery: phase === 'proposed' ? 94 - index * 3 : null, link: 'wifi',
  }));
}

function newState(phase, speed = 1, running = true) {
  return {
    phase, scenario: 'normal', running, speed, elapsed: 0, nodes: nodesFor(phase),
    gatewayOnline: true, routeMode: 'wifi', buffered: 0, delivered: 0, dropped: 0,
    latency: 0, deliveryRate: 100,
    risk: { score: 0, level: 'Normal', factors: phase === 'prototype' ? ['Risk analysis is a proposed capability.'] : ['All simulated channels are near baseline.'] },
    events: [], alerts: [], history: [], packet: null, camera: null,
  };
}

export class SimulationEngine {
  constructor() {
    this._listeners = new Set();
    this._eventId = 0;
    this._packetId = 0;
    this.state = newState('prototype');
    this._initialize();
  }

  getState() { return this.state; }

  subscribe(listener) {
    this._listeners.add(listener);
    listener(this.state);
    return () => this._listeners.delete(listener);
  }

  _emit() { for (const listener of this._listeners) listener(this.state); }

  _initialize() {
    this._buffer = [];
    this._pending = [];
    this._marks = new Set();
    this._sampleIndex = 0;
    this._nextSample = SAMPLE_SECONDS;
    this._nextHistory = 0;
    this._emissionClock = 0;
    this._activeTime = 0;
    this._addEvent('info', this.state.phase === 'prototype' ? 'Prototype demonstration ready' : 'Proposed system demonstration ready', this.state.phase === 'prototype'
      ? 'Three simulated ESP32 nodes → painlessMesh root → mDNS → Flask → dashboard. No live hardware is connected.'
      : 'Seven illustrative stations. LoRa, AI, risk analysis, solar power and recovery behavior require implementation and validation.');
    this._sample('n1');
    this._recordHistory();
  }

  setPhase(phase) {
    if (!['prototype', 'proposed'].includes(phase)) throw new RangeError('Unknown system phase.');
    if (phase === this.state.phase) return;
    this.state = newState(phase, this.state.speed, this.state.running);
    this._initialize();
    this._emit();
  }

  setRunning(running) { this.state.running = Boolean(running); this._emit(); }

  setSpeed(speed) {
    if (![1, 2, 4].includes(Number(speed))) throw new RangeError('Simulation speed must be 1, 2 or 4.');
    this.state.speed = Number(speed);
    this._emit();
  }

  reset() {
    this.state = newState(this.state.phase, this.state.speed, true);
    this._initialize();
    this._emit();
  }

  trigger(id) {
    const scenario = SCENARIOS.find(item => item.id === id);
    if (!scenario) throw new RangeError(`Unknown scenario: ${id}`);
    if (scenario.proposedOnly && this.state.phase !== 'proposed') return false;

    if (id === 'gateway-recovery') {
      this.state.scenario = id;
      this.state.gatewayOnline = true;
      this.state.routeMode = 'wifi';
      for (const node of this.state.nodes) { node.online = true; node.link = 'wifi'; }
      this._marks.clear();
      this._addEvent('success', 'Gateway connection restored', this.state.phase === 'proposed'
        ? `${this._buffer.length} buffered packet(s) are eligible for replay through the proposed store-and-forward path.`
        : 'New sensor messages can reach the dashboard again. Prototype packets lost during an outage are not replayed.');
      if (!this.state.packet) this._startNext();
      if (!this.state.packet) this._sample('n2');
      this._emit();
      return true;
    }

    // Each scenario is a separate demonstration, with a clean baseline.
    // Recovery is intentionally the exception: it retains actual buffered data.
    this.state = newState(this.state.phase, this.state.speed, this.state.running);
    this._initialize();
    this.state.scenario = id;
    this.state.packet = null;
    this._pending = [];
    this._addEvent('info', scenario.label, scenario.description);
    const node2 = this.state.nodes[1];
    if (['motion', 'human', 'animal', 'vehicle', 'unknown'].includes(id)) {
      node2.motion = true;
      this._addEvent('warning', 'PIR movement detected', 'Node 02 produced a simulated motion=true reading. PIR alone cannot classify the moving object.', 'n2');
      if (id !== 'motion') this.state.camera = { kind: id, stage: 'PIR triggered', verified: false, confidence: null, nodeId: 'n2', time: 0 };
    }
    if (id === 'wifi-failure' || id === 'lora-backup') {
      this.state.routeMode = 'offline';
      for (const node of this.state.nodes) node.link = 'offline';
      this._addEvent('warning', 'Wi-Fi path unavailable', id === 'lora-backup' ? 'Proposed route selection is searching for a configured LoRa path.' : 'There is no active alternative path in this scenario.');
    }
    if (id === 'gateway-failure') {
      this.state.gatewayOnline = false;
      this._addEvent('critical', 'Central gateway offline', 'The Raspberry Pi and dashboard cannot receive new sensor packets through this gateway.');
    }
    if (id === 'node-failure') {
      node2.online = false;
      node2.link = 'offline';
      this._addEvent('warning', 'Node 02 unreachable', 'Simulated radio/link failure. The remaining stations continue to report.', 'n2');
    }
    if (id === 'low-battery') {
      node2.battery = 14;
      this._addEvent('warning', 'Low battery · Node 02', 'Illustrative charge is 14%. Solar charging and power-aware operation are proposed, not measured.', 'n2');
    }
    this._sample(['motion', 'human', 'animal', 'vehicle', 'unknown', 'node-failure', 'low-battery'].includes(id) ? 'n2' : 'n1');
    this._updateRisk();
    this._emit();
    return true;
  }

  tick(dt) {
    if (!this.state.running || !Number.isFinite(dt) || dt <= 0) return;
    let remaining = dt * this.state.speed;
    while (remaining > 0.000001) {
      const step = Math.min(remaining, 0.1);
      remaining -= step;
      this.state.elapsed += step;
      this._updateReadings();
      this._updateScenario();
      this._updateRisk();
      if (this.state.elapsed + 0.00001 >= this._nextSample) {
        this._sampleIndex = (this._sampleIndex + 1) % this.state.nodes.length;
        this._sample(this.state.nodes[this._sampleIndex].id);
        this._nextSample += this.state.scenario === 'low-battery' ? SAMPLE_SECONDS * 1.5 : SAMPLE_SECONDS;
      }
      this._advancePacket(step);
      if (this.state.elapsed + 0.00001 >= this._nextHistory) {
        this._recordHistory();
        this._nextHistory = Math.floor(this.state.elapsed) + 1;
      }
      this._refreshMetrics();
    }
    this._emissionClock += dt;
    if (this._emissionClock >= 0.25) { this._emissionClock %= 0.25; this._emit(); }
  }

  _once(key, at, action) {
    if (this.state.elapsed >= at && !this._marks.has(key)) { this._marks.add(key); action(); }
  }

  _updateScenario() {
    const { scenario, phase } = this.state;
    if (scenario === 'lora-backup') this._once('lora', 3, () => {
      this.state.routeMode = 'lora';
      for (const node of this.state.nodes) node.link = 'lora';
      this._addEvent('success', 'Available LoRa route selected', 'Proposed SX1278 sensor-packet path selected. Image transfer still requires Wi-Fi; these small JSON packets are modeled over LoRa.');
      this._startNext();
    });
    if (scenario === 'node-failure' && phase === 'proposed') {
      this._once('failed-link', 2, () => this._addEvent('warning', 'Failed link identified', 'Proposed health monitoring identifies the unreachable Node 02 link.', 'n2'));
      this._once('reroute', 4, () => {
        this.state.routeMode = 'rerouting';
        this._addEvent('info', 'Alternative route selected', 'Reachable nodes route around the unavailable relay. Node 02 retains its locally buffered sensor message until it reconnects.', 'n2');
        this._sample('n3');
      });
      this._once('reconnected', 9, () => {
        this.state.nodes[1].online = true;
        this.state.nodes[1].link = 'wifi';
        this.state.routeMode = 'wifi';
        this._addEvent('success', 'Node 02 link restored', 'Proposed buffered messages can now travel via the available mesh path.', 'n2');
        this._startNext();
      });
    }
    const camera = this.state.camera;
    if (camera) {
      const steps = [[1, 'Image captured'], [2.5, 'Wi-Fi image transfer'], [4, 'Raspberry Pi · YOLO inference'], [6, 'Event verification'], [7.5, 'Dashboard alert']];
      for (const [time, stage] of steps) this._once(`camera-${time}`, time, () => {
        camera.stage = stage;
        if (time === 4) camera.confidence = { human: 0.94, animal: 0.91, vehicle: 0.96, unknown: 0.42 }[camera.kind];
        if (time === 7.5) {
          // verified means the event pipeline finished; an unknown object has
          // not acquired a verified identity and still needs human review.
          camera.verified = true;
          camera.time = round(this.state.elapsed);
          if (camera.kind === 'unknown') {
            camera.stage = 'Dashboard review needed';
            this._addEvent('warning', 'Unknown object · review needed', 'The illustrative camera result is inconclusive. The object remains unidentified; 42% is a scripted confidence value and does not verify an identity.', 'n2');
          } else this._addEvent(camera.kind === 'animal' ? 'success' : 'warning', `${camera.kind[0].toUpperCase()}${camera.kind.slice(1)} event · simulated verification`, `Illustrative ${camera.kind} classification at Northern trail. Confidence is a scripted demo value, not a model result.`, 'n2');
        }
      });
    }
    if (scenario === 'motion') this._once('motion-clear', 12, () => {
      this.state.nodes[1].motion = false;
      this._addEvent('info', 'Motion input returned to idle', 'The recorded detection remains in this scenario’s event history.', 'n2');
    });
  }

  _updateReadings() {
    const { elapsed: time, scenario } = this.state;
    for (let index = 0; index < this.state.nodes.length; index++) {
      const node = this.state.nodes[index];
      // Offline nodes retain the last visible reading until they reconnect.
      if (!node.online) continue;
      const noise = Math.sin(time * 0.24 + index) * 0.28;
      node.temp = round(28.5 + index * 0.2 + noise);
      node.humidity = round(65 - index + Math.sin(time * 0.16 + index) * 0.8);
      node.gas = Math.round(120 + index * 5 + Math.sin(time * 0.3 + index) * 4);
      if (scenario === 'temperature' && index < 3) node.temp = round(node.temp + clamp(time / 20) * (15 - index));
      if (scenario === 'fire' && index < 3) {
        const progress = clamp((time - index * 0.8) / 22);
        node.temp = round(node.temp + progress * (32 - index * 2));
        node.humidity = round(node.humidity - progress * (44 - index * 2));
        node.gas = Math.round(node.gas + progress * (780 - index * 60));
      }
    }
    if (scenario === 'low-battery') this.state.nodes[1].battery = round(Math.max(10, 14 - time * 0.012));
  }

  _updateRisk() {
    if (this.state.phase !== 'proposed') return;
    const nodes = this.state.nodes.filter(node => node.online);
    const abnormal = nodes.filter(node => node.temp > 36 && node.humidity < 50 && node.gas > 260);
    const hottest = Math.max(...nodes.map(node => node.temp), 28.5);
    const driest = Math.min(...nodes.map(node => node.humidity), 65);
    const gassiest = Math.max(...nodes.map(node => node.gas), 120);
    let score = Math.round(40 * clamp((hottest - 30) / 27) + 25 * clamp((60 - driest) / 35) + 35 * clamp((gassiest - 150) / 650));
    // A single elevated gas reading can never establish a high fire-risk state.
    if (abnormal.length < 2) score = Math.min(score, 44);
    const level = score >= 75 ? 'High-Priority Alert' : score >= 45 ? 'Potential Fire Risk' : score >= 20 ? 'Environmental Warning' : 'Normal';
    const factors = [];
    if (hottest > 35) factors.push('Temperature rising');
    if (driest < 50) factors.push('Low humidity');
    if (gassiest > 260) factors.push('Elevated raw gas/smoke channel');
    if (abnormal.length >= 2) factors.push(`${abnormal.length} nearby nodes corroborate the trend`);
    if (!factors.length) factors.push('All simulated channels are near baseline.');
    if (level !== this.state.risk.level) this._addEvent(level === 'High-Priority Alert' ? 'critical' : level === 'Normal' ? 'success' : 'warning', level, `Illustrative score ${score}/100. Multi-sensor risk indicator only; field verification is required.`);
    this.state.risk = { score, level, factors };
  }

  _sample(nodeId) {
    const node = this.state.nodes.find(item => item.id === nodeId);
    const packet = {
      id: ++this._packetId, nodeId, stage: 0, stageLabel: FLOW_STEPS[0], progress: 0,
      path: this._packetPath(nodeId),
      transport: this.state.routeMode === 'lora' ? 'lora' : 'wifi',
      payload: {
        simulated: true, phase: this.state.phase, node_id: nodeId, sample_time_s: round(this.state.elapsed, 2),
        temperature_c: node.temp, humidity_pct: node.humidity, gas_raw: node.gas, motion: node.motion,
        ...(this.state.phase === 'proposed' ? { battery_pct: node.battery } : {}),
      },
      createdAt: this.state.elapsed, recovered: false,
    };
    if (!this.state.packet) { this.state.packet = packet; this._activeTime = 0; }
    else this._pending.push(packet);
  }

  _available(packet, refreshRoute = false) {
    if (!this.state.gatewayOnline || this.state.routeMode === 'offline') return false;
    const transport = refreshRoute ? (this.state.routeMode === 'lora' ? 'lora' : 'wifi') : packet.transport;
    const route = refreshRoute ? getMeshRoute(this.state, packet.nodeId) : packet.path.slice(0, packet.path.indexOf('mesh-root') + 1);
    if (route.length < 2 || route[0] !== packet.nodeId || route.at(-1) !== 'mesh-root') return false;
    const nodes = new Map(this.state.nodes.map(node => [node.id, node]));
    if (route.slice(0, -1).some(id => !nodes.get(id)?.online || nodes.get(id)?.link !== transport)) return false;
    if (transport === 'lora') return this.state.routeMode === 'lora' && route.length === 2;
    const links = getMeshLinks(this.state);
    return route.slice(0, -1).every((from, index) => links.some(link => link.status !== 'offline' &&
      ((link.from === from && link.to === route[index + 1]) || (link.to === from && link.from === route[index + 1]))));
  }

  _packetPath(nodeId) {
    return [...getMeshRoute(this.state, nodeId), 'raspberry-pi', 'dashboard'];
  }

  _beginMeshStage(packet) {
    packet.path = this._packetPath(packet.nodeId);
    packet.transport = this.state.routeMode === 'lora' ? 'lora' : 'wifi';
    const route = packet.path.slice(0, packet.path.indexOf('mesh-root') + 1).map(id => id === 'mesh-root' ? 'root' : id);
    packet.stageLabel = `${packet.transport === 'lora' ? 'Proposed LoRa' : 'Wi-Fi mesh'}: ${route.join(' → ')}`;
  }

  _blockPacket(packet) {
    if (this.state.phase === 'proposed' && this._buffer.length < BUFFER_LIMIT) {
      packet.stage = 2;
      packet.progress = 0;
      packet.recovered = true;
      this._buffer.push(packet);
      this._addEvent('warning', 'Sensor packet buffered', `Packet ${packet.id} retained by proposed local store-and-forward until every relay on its path becomes available.`, packet.nodeId);
    } else {
      this.state.dropped++;
      this._addEvent('warning', 'Sensor packet not delivered', this.state.phase === 'prototype' ? 'No reachable gateway path; an unavailable relay blocks delivery. Buffering is not claimed for the current prototype.' : 'The illustrative buffer is full; this packet was dropped.', packet.nodeId);
    }
    this.state.packet = null;
    this._activeTime = 0;
    this._startNext();
  }

  _advancePacket(dt) {
    let remaining = dt;
    if (!this.state.packet) this._startNext();
    while (this.state.packet && remaining > 0.000001) {
      const packet = this.state.packet;
      // Reject a failed relay before advancing any visible transmission.
      if (packet.stage >= 2 && !this._available(packet)) { this._blockPacket(packet); continue; }
      const duration = packet.stage === 2 ? MESH_HOP_SECONDS * Math.max(1, packet.path.indexOf('mesh-root')) : STAGE_SECONDS;
      const consumed = Math.min(remaining, Math.max(0, duration - this._activeTime));
      this._activeTime += consumed;
      remaining -= consumed;
      packet.progress = clamp(this._activeTime / duration);
      if (packet.progress < 1 - 0.000001) break;
      this._activeTime = 0;
      if (packet.stage === 7) {
        this.state.delivered++;
        this.state.latency = Math.round((this.state.elapsed - packet.createdAt) * 1000);
        this._addEvent('success', packet.recovered ? 'Recovered packet received' : 'Dashboard received sensor data', `${this.state.nodes.find(node => node.id === packet.nodeId)?.name} · packet ${packet.id} · ${packet.payload.motion ? 'motion detected' : 'environmental reading'} · ${packet.transport === 'lora' ? 'proposed LoRa' : 'Wi-Fi mesh'} path.`, packet.nodeId);
        this.state.packet = null;
        this._startNext();
        continue;
      }
      packet.stage++;
      packet.progress = 0;
      if (packet.stage === 2) this._beginMeshStage(packet);
      else packet.stageLabel = FLOW_STEPS[packet.stage];
      if (packet.stage === 3) this._addEvent('info', 'Raspberry Pi discovered', 'mDNS / Avahi resolves the Raspberry Pi service on the local IP network.', packet.nodeId);
      if (packet.stage === 5) this._addEvent('info', 'Flask API received JSON', 'The simulated HTTP POST payload is ready for backend processing.', packet.nodeId);
    }
  }

  _startNext() {
    if (this.state.packet) return;
    const recoveredIndex = this._buffer.findIndex(packet => this._available(packet, true));
    if (recoveredIndex >= 0) {
      this.state.packet = this._buffer.splice(recoveredIndex, 1)[0];
      this.state.packet.progress = 0;
      this._beginMeshStage(this.state.packet);
    } else if (this._pending.length) this.state.packet = this._pending.shift();
    this._activeTime = 0;
    this._refreshMetrics();
  }

  _refreshMetrics() {
    this.state.buffered = this._buffer.length;
    const total = this.state.delivered + this.state.dropped + this.state.buffered + this._pending.length + Number(Boolean(this.state.packet));
    this.state.deliveryRate = total ? round(this.state.delivered / total * 100) : 100;
  }

  _recordHistory() {
    const node = this.state.nodes[0];
    this.state.history.push({ time: round(this.state.elapsed), temp: node.temp, humidity: node.humidity, gas: node.gas, risk: this.state.risk.score });
    if (this.state.history.length > 90) this.state.history.splice(0, this.state.history.length - 90);
  }

  _addEvent(type, title, detail, nodeId = null) {
    const event = { id: ++this._eventId, time: round(this.state.elapsed, 1), type, title, detail, nodeId };
    this.state.events.unshift(event);
    if (this.state.events.length > 60) this.state.events.length = 60;
    // Routine packet traffic must not evict threat or verified wildlife history.
    if (type === 'warning' || type === 'critical' || (type === 'success' && title.includes('event · simulated verification'))) {
      this.state.alerts.unshift(event);
      if (this.state.alerts.length > 30) this.state.alerts.length = 30;
    }
  }
}
