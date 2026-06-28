'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Project, Provider, RefreshType, REFRESH_TYPE_COLORS, getCarrierForCountry } from '@/lib/types'
import {
  Activity, Wifi, WifiOff, AlertTriangle, CheckCircle,
  Pause, Play, Trash2, Radio,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ── Types ─────────────────────────────────────────────────────────────────────
type Severity = 'critical' | 'warning' | 'info' | 'resolved'

type EventType =
  // Generic WAN
  | 'link_down' | 'link_up'
  | 'high_latency' | 'latency_ok'
  | 'jitter_alert' | 'packet_loss'
  | 'bgp_down' | 'bgp_up'
  | 'interface_error' | 'recovered'
  | 'vrrp_failover' | 'vrrp_restored'
  | 'bw_saturation' | 'bw_normal'
  | 'maintenance_start' | 'maintenance_end'
  // SD-WAN
  | 'sdwan_steering' | 'sdwan_restored'
  | 'sdwan_sla_violated' | 'sdwan_path_failover'
  | 'sdwan_policy_applied' | 'sdwan_tunnel_down'
  // SAP
  | 'sap_rfc_timeout' | 'sap_hana_latency'
  | 'sap_session_drop' | 'sap_link_saturated'
  | 'sap_connection_ok' | 'sap_rfc_restored'
  // Wi-Fi
  | 'wifi_ap_down' | 'wifi_ap_up'
  | 'wifi_roaming_fail' | 'wifi_channel_interference'
  | 'wifi_ssid_restored' | 'wifi_client_disassoc'
  // MPLS
  | 'mpls_lsp_down' | 'mpls_lsp_up'
  | 'mpls_te_reroute' | 'mpls_qos_drop'
  | 'mpls_ce_pe_down' | 'mpls_ce_pe_up'
  // Fiber
  | 'fiber_cut' | 'fiber_restored'
  | 'fiber_signal_degraded' | 'fiber_connector_error'
  // LTE / 4G
  | 'lte_failover' | 'lte_primary_restored'
  | 'lte_signal_low' | 'lte_carrier_congestion'
  // VoIP
  | 'voip_mos_drop' | 'voip_mos_ok'
  | 'voip_codec_mismatch' | 'voip_jitter_buffer'
  | 'voip_gateway_unreachable' | 'voip_gateway_ok'
  // COLOC / DIA
  | 'coloc_power_alert' | 'coloc_cooling_warn'
  | 'dia_burst_exceeded' | 'dia_cir_ok'

interface NetEvent {
  id: string
  ts: Date
  siteId: string
  siteName: string
  country: string
  provider: string
  refreshType?: RefreshType
  type: EventType
  severity: Severity
  message: string
  metric?: string
}

interface SiteHealth {
  siteId: string
  siteName: string
  country: string
  provider: string
  refreshType?: RefreshType
  state: 'up' | 'degraded' | 'down'
  latency: number
  jitter: number
  loss: number
  uptime: number
  stability: number
}

// ── Event templates ────────────────────────────────────────────────────────────
type Tmpl = { severity: Severity; msgFn: (h: SiteHealth) => string; metricFn?: (h: SiteHealth) => string }
const T: Record<EventType, Tmpl> = {
  // Generic WAN
  link_down:         { severity: 'critical',  msgFn: h => `Link DOWN on ${h.provider} — no carrier signal`,                     metricFn: _ => 'Loss: 100%' },
  link_up:           { severity: 'resolved',  msgFn: h => `Link UP restored on ${h.provider}`,                                  metricFn: _ => 'Loss: 0%' },
  high_latency:      { severity: 'warning',   msgFn: h => `High latency on ${h.provider} WAN path`,                             metricFn: h => `RTT: ${h.latency}ms (threshold 80ms)` },
  latency_ok:        { severity: 'info',      msgFn: h => `Latency normalised on ${h.provider}`,                                metricFn: h => `RTT: ${h.latency}ms` },
  jitter_alert:      { severity: 'warning',   msgFn: h => `Jitter spike on ${h.provider} — real-time traffic impacted`,         metricFn: h => `Jitter: ${h.jitter}ms (threshold 20ms)` },
  packet_loss:       { severity: 'warning',   msgFn: h => `Packet loss detected — ${h.provider} circuit unstable`,              metricFn: h => `Loss: ${h.loss.toFixed(1)}%` },
  bgp_down:          { severity: 'critical',  msgFn: h => `BGP session dropped with ${h.provider} peer`,                       metricFn: _ => 'AS path lost' },
  bgp_up:            { severity: 'resolved',  msgFn: h => `BGP session re-established with ${h.provider}`,                     metricFn: _ => 'Routes received' },
  interface_error:   { severity: 'warning',   msgFn: h => `CRC errors on ${h.provider} WAN port`,                              metricFn: _ => 'CRC errors: ↑' },
  recovered:         { severity: 'resolved',  msgFn: h => `Circuit fully recovered — ${h.provider} performing normally`,        metricFn: h => `RTT: ${h.latency}ms · Loss: 0%` },
  vrrp_failover:     { severity: 'critical',  msgFn: h => `VRRP failover — backup router ACTIVE at ${h.siteName}`,             metricFn: _ => 'Primary router unreachable' },
  vrrp_restored:     { severity: 'resolved',  msgFn: h => `VRRP restored — primary router ACTIVE at ${h.siteName}`,            metricFn: _ => 'Failback complete' },
  bw_saturation:     { severity: 'warning',   msgFn: h => `Bandwidth near saturation on ${h.provider}`,                        metricFn: _ => 'Utilisation: 94% of CIR' },
  bw_normal:         { severity: 'info',      msgFn: h => `Bandwidth utilisation normal on ${h.provider}`,                     metricFn: _ => 'Utilisation: 41%' },
  maintenance_start: { severity: 'info',      msgFn: h => `Carrier maintenance window started — ${h.provider}`,                metricFn: _ => 'Expected duration: 2h' },
  maintenance_end:   { severity: 'resolved',  msgFn: h => `Carrier maintenance completed — ${h.provider} circuit restored`,    metricFn: _ => 'All paths up' },
  // SD-WAN
  sdwan_steering:      { severity: 'warning',  msgFn: h => `SD-WAN steering: traffic shifted from MPLS to broadband at ${h.siteName}`, metricFn: h => `${h.provider} MPLS SLA violated` },
  sdwan_restored:      { severity: 'resolved', msgFn: h => `SD-WAN steering reverted — MPLS primary path restored`,                    metricFn: h => `RTT: ${h.latency}ms · SLA met` },
  sdwan_sla_violated:  { severity: 'warning',  msgFn: h => `SD-WAN SLA violation on ${h.provider}: latency threshold exceeded`,        metricFn: h => `RTT: ${h.latency}ms / threshold 50ms` },
  sdwan_path_failover: { severity: 'critical', msgFn: h => `SD-WAN path failover at ${h.siteName} — primary WAN unreachable`,          metricFn: _ => 'Failover to secondary WAN' },
  sdwan_policy_applied:{ severity: 'info',     msgFn: h => `SD-WAN policy updated at ${h.siteName} — traffic class rules reloaded`,    metricFn: _ => 'Policy version: v2.4' },
  sdwan_tunnel_down:   { severity: 'critical', msgFn: h => `SD-WAN overlay tunnel DOWN at ${h.siteName}`,                             metricFn: _ => 'IKEv2 negotiation failed' },
  // SAP
  sap_rfc_timeout:     { severity: 'critical', msgFn: h => `SAP RFC connection timeout at ${h.siteName} — ERP unreachable`,            metricFn: _ => 'RFC timeout: >30s' },
  sap_hana_latency:    { severity: 'warning',  msgFn: h => `SAP HANA query latency spike at ${h.siteName}`,                           metricFn: h => `DB RTT: ${h.latency + 20}ms (normal <10ms)` },
  sap_session_drop:    { severity: 'critical', msgFn: h => `SAP GUI sessions dropped at ${h.siteName} — link flap detected`,           metricFn: _ => 'Sessions lost: active users affected' },
  sap_link_saturated:  { severity: 'warning',  msgFn: h => `SAP connectivity near bandwidth limit on ${h.provider}`,                  metricFn: _ => 'SAP traffic: 88% of allocated QoS class' },
  sap_connection_ok:   { severity: 'resolved', msgFn: h => `SAP connectivity stable at ${h.siteName} — all sessions active`,          metricFn: h => `RFC RTT: ${h.latency}ms` },
  sap_rfc_restored:    { severity: 'resolved', msgFn: h => `SAP RFC connection restored at ${h.siteName}`,                            metricFn: _ => 'ERP accessible, sync resumed' },
  // Wi-Fi
  wifi_ap_down:          { severity: 'critical', msgFn: h => `AP offline at ${h.siteName} — clients disconnected`,                    metricFn: _ => 'AP heartbeat lost > 30s' },
  wifi_ap_up:            { severity: 'resolved', msgFn: h => `AP restored at ${h.siteName} — clients reconnecting`,                   metricFn: _ => 'SSID broadcasting' },
  wifi_roaming_fail:     { severity: 'warning',  msgFn: h => `802.11r fast roaming failure at ${h.siteName}`,                         metricFn: _ => 'Client sticky on distant AP' },
  wifi_channel_interference: { severity: 'warning', msgFn: h => `RF interference detected at ${h.siteName} — channel congested`,      metricFn: _ => 'Channel utilisation: 91%' },
  wifi_ssid_restored:    { severity: 'resolved', msgFn: h => `SSID broadcast restored at ${h.siteName} after AP reboot`,              metricFn: _ => 'Client capacity: normal' },
  wifi_client_disassoc:  { severity: 'warning',  msgFn: h => `Mass client disassociation event at ${h.siteName}`,                    metricFn: _ => 'Affected clients: 12' },
  // MPLS
  mpls_lsp_down:   { severity: 'critical', msgFn: h => `MPLS LSP DOWN — ${h.provider} label path unreachable`,                       metricFn: _ => 'No RSVP-TE path available' },
  mpls_lsp_up:     { severity: 'resolved', msgFn: h => `MPLS LSP restored on ${h.provider} — traffic forwarding resumed`,            metricFn: _ => 'RSVP-TE re-established' },
  mpls_te_reroute: { severity: 'warning',  msgFn: h => `MPLS TE path rerouted at ${h.siteName} — link congestion`,                   metricFn: _ => 'New path: 2 extra hops' },
  mpls_qos_drop:   { severity: 'warning',  msgFn: h => `MPLS QoS drop on ${h.provider} — EF queue overrun`,                         metricFn: _ => 'EF queue drops: 847 pkts' },
  mpls_ce_pe_down: { severity: 'critical', msgFn: h => `CE-PE BGP session dropped — ${h.provider} PE unreachable`,                   metricFn: _ => 'VRF routes withdrawn' },
  mpls_ce_pe_up:   { severity: 'resolved', msgFn: h => `CE-PE BGP session restored on ${h.provider}`,                               metricFn: _ => 'VRF routes re-advertised' },
  // Fiber
  fiber_cut:              { severity: 'critical', msgFn: h => `Physical fiber cut detected on ${h.provider} — dark fiber`,           metricFn: _ => 'Signal loss: -40dBm' },
  fiber_restored:         { severity: 'resolved', msgFn: h => `Fiber path restored on ${h.provider} — splice complete`,              metricFn: _ => 'Signal: -8dBm (nominal)' },
  fiber_signal_degraded:  { severity: 'warning',  msgFn: h => `Optical signal degraded on ${h.provider} fiber`,                     metricFn: _ => 'Rx power: -22dBm (threshold -18dBm)' },
  fiber_connector_error:  { severity: 'warning',  msgFn: h => `Fiber connector loss too high at ${h.siteName} patch panel`,         metricFn: _ => 'Insertion loss: 4.2dB (limit 3dB)' },
  // LTE
  lte_failover:          { severity: 'warning',  msgFn: h => `LTE backup activated at ${h.siteName} — primary WAN down`,            metricFn: _ => 'LTE RSRP: -85dBm · Active' },
  lte_primary_restored:  { severity: 'resolved', msgFn: h => `Primary WAN restored at ${h.siteName} — LTE in standby`,              metricFn: _ => 'LTE: standby' },
  lte_signal_low:        { severity: 'warning',  msgFn: h => `LTE signal below threshold at ${h.siteName}`,                        metricFn: _ => 'RSRP: -108dBm (threshold -100dBm)' },
  lte_carrier_congestion:{ severity: 'warning',  msgFn: h => `LTE carrier congestion detected — ${h.provider} cell loaded`,         metricFn: _ => 'Throughput: 2.1 Mbps (typical 18 Mbps)' },
  // VoIP
  voip_mos_drop:          { severity: 'warning',  msgFn: h => `VoIP quality degraded at ${h.siteName} — MOS below threshold`,      metricFn: _ => 'MOS: 2.8 (threshold 3.5)' },
  voip_mos_ok:            { severity: 'resolved', msgFn: h => `VoIP quality restored at ${h.siteName}`,                             metricFn: _ => 'MOS: 4.2' },
  voip_codec_mismatch:    { severity: 'warning',  msgFn: h => `VoIP codec negotiation failed at ${h.siteName}`,                    metricFn: _ => 'G.711 ↔ G.729 mismatch' },
  voip_jitter_buffer:     { severity: 'warning',  msgFn: h => `Jitter buffer overflow on VoIP path at ${h.siteName}`,              metricFn: h => `Jitter: ${h.jitter}ms — buffer: 30ms` },
  voip_gateway_unreachable:{ severity: 'critical', msgFn: h => `VoIP gateway unreachable at ${h.siteName} — calls failing`,        metricFn: _ => 'SIP REGISTER: 408 timeout' },
  voip_gateway_ok:        { severity: 'resolved', msgFn: h => `VoIP gateway reachable — SIP registration restored at ${h.siteName}`,metricFn: _ => 'SIP 200 OK' },
  // COLOC / DIA
  coloc_power_alert: { severity: 'critical', msgFn: h => `UPS power alert at ${h.siteName} co-location facility`,                  metricFn: _ => 'Feed A: failed — Feed B: active' },
  coloc_cooling_warn:{ severity: 'warning',  msgFn: h => `Cooling threshold exceeded at ${h.siteName} cage`,                       metricFn: _ => 'Temp: 32°C (limit 28°C)' },
  dia_burst_exceeded:{ severity: 'warning',  msgFn: h => `DIA burst allowance exceeded on ${h.provider}`,                         metricFn: _ => 'Burst: 112% of CIR' },
  dia_cir_ok:        { severity: 'info',     msgFn: h => `DIA circuit operating within SLA on ${h.provider}`,                     metricFn: h => `RTT: ${h.latency}ms · Loss: 0%` },
}

// ── Technology-specific event pools ───────────────────────────────────────────
const TECH_POOLS: Record<string, { down: EventType[]; degraded: EventType[]; up: EventType[] }> = {
  SDWAN: {
    down:     ['sdwan_tunnel_down', 'sdwan_path_failover', 'link_down', 'bgp_down', 'vrrp_failover', 'sdwan_tunnel_down', 'link_up', 'bgp_up', 'vrrp_restored'],
    degraded: ['sdwan_sla_violated', 'sdwan_steering', 'high_latency', 'bw_saturation', 'packet_loss', 'jitter_alert', 'sdwan_restored'],
    up:       ['sdwan_policy_applied', 'sdwan_restored', 'latency_ok', 'bw_normal', 'recovered', 'sdwan_sla_violated', 'high_latency'],
  },
  SAP: {
    down:     ['sap_rfc_timeout', 'sap_session_drop', 'link_down', 'bgp_down', 'sap_rfc_restored', 'link_up', 'sap_connection_ok'],
    degraded: ['sap_hana_latency', 'sap_link_saturated', 'high_latency', 'bw_saturation', 'packet_loss', 'sap_connection_ok'],
    up:       ['sap_connection_ok', 'sap_rfc_restored', 'latency_ok', 'bw_normal', 'sap_hana_latency', 'dia_cir_ok'],
  },
  WIFI: {
    down:     ['wifi_ap_down', 'wifi_client_disassoc', 'link_down', 'wifi_ap_up', 'wifi_ssid_restored', 'link_up'],
    degraded: ['wifi_roaming_fail', 'wifi_channel_interference', 'wifi_client_disassoc', 'high_latency', 'jitter_alert', 'wifi_ssid_restored'],
    up:       ['wifi_ap_up', 'wifi_ssid_restored', 'latency_ok', 'bw_normal', 'wifi_channel_interference', 'wifi_roaming_fail'],
  },
  MPLS: {
    down:     ['mpls_lsp_down', 'mpls_ce_pe_down', 'bgp_down', 'link_down', 'mpls_lsp_up', 'mpls_ce_pe_up', 'bgp_up', 'link_up'],
    degraded: ['mpls_te_reroute', 'mpls_qos_drop', 'high_latency', 'bw_saturation', 'packet_loss', 'mpls_lsp_up'],
    up:       ['mpls_lsp_up', 'mpls_ce_pe_up', 'latency_ok', 'bw_normal', 'recovered', 'mpls_qos_drop', 'mpls_te_reroute'],
  },
  FIBER: {
    down:     ['fiber_cut', 'fiber_signal_degraded', 'link_down', 'bgp_down', 'fiber_restored', 'link_up', 'bgp_up'],
    degraded: ['fiber_signal_degraded', 'fiber_connector_error', 'high_latency', 'packet_loss', 'fiber_restored'],
    up:       ['fiber_restored', 'latency_ok', 'bw_normal', 'fiber_signal_degraded', 'dia_cir_ok', 'fiber_connector_error'],
  },
  LTE: {
    down:     ['lte_signal_low', 'link_down', 'lte_failover', 'lte_primary_restored', 'link_up'],
    degraded: ['lte_signal_low', 'lte_carrier_congestion', 'lte_failover', 'high_latency', 'bw_saturation', 'lte_primary_restored'],
    up:       ['lte_primary_restored', 'latency_ok', 'bw_normal', 'lte_carrier_congestion', 'dia_cir_ok'],
  },
  VOIP: {
    down:     ['voip_gateway_unreachable', 'link_down', 'bgp_down', 'voip_gateway_ok', 'link_up'],
    degraded: ['voip_mos_drop', 'voip_jitter_buffer', 'voip_codec_mismatch', 'jitter_alert', 'high_latency', 'voip_mos_ok'],
    up:       ['voip_mos_ok', 'voip_gateway_ok', 'latency_ok', 'bw_normal', 'voip_mos_drop', 'voip_jitter_buffer'],
  },
  COLOC: {
    down:     ['coloc_power_alert', 'link_down', 'bgp_down', 'link_up', 'bgp_up', 'recovered'],
    degraded: ['coloc_cooling_warn', 'dia_burst_exceeded', 'bw_saturation', 'high_latency', 'dia_cir_ok'],
    up:       ['dia_cir_ok', 'latency_ok', 'bw_normal', 'maintenance_start', 'maintenance_end', 'coloc_cooling_warn'],
  },
  HYBRID: {
    down:     ['sdwan_path_failover', 'mpls_lsp_down', 'link_down', 'bgp_down', 'sdwan_restored', 'link_up', 'bgp_up'],
    degraded: ['sdwan_sla_violated', 'sdwan_steering', 'mpls_te_reroute', 'high_latency', 'bw_saturation', 'sdwan_restored'],
    up:       ['sdwan_policy_applied', 'mpls_lsp_up', 'latency_ok', 'bw_normal', 'recovered', 'sdwan_sla_violated'],
  },
  DIA_ONLY: {
    down:     ['link_down', 'bgp_down', 'link_up', 'bgp_up', 'recovered'],
    degraded: ['high_latency', 'packet_loss', 'bw_saturation', 'dia_burst_exceeded', 'jitter_alert', 'latency_ok'],
    up:       ['dia_cir_ok', 'latency_ok', 'bw_normal', 'maintenance_start', 'maintenance_end', 'high_latency'],
  },
  default: {
    down:     ['link_down', 'link_down', 'bgp_down', 'vrrp_failover', 'packet_loss', 'bgp_up', 'link_up', 'vrrp_restored'],
    degraded: ['high_latency', 'jitter_alert', 'packet_loss', 'sdwan_steering', 'bw_saturation', 'voip_mos_drop', 'interface_error', 'latency_ok'],
    up:       ['latency_ok', 'latency_ok', 'recovered', 'bw_normal', 'voip_mos_ok', 'maintenance_start', 'maintenance_end', 'high_latency'],
  },
}

// ── Tech badge styles ─────────────────────────────────────────────────────────
// Tailwind classes for refresh type tag in event rows
const TECH_BADGE: Record<string, string> = {
  SDWAN:    'bg-purple-950/60 text-purple-300 border-purple-700/50',
  SAP:      'bg-blue-950/60 text-blue-300 border-blue-700/50',
  WIFI:     'bg-cyan-950/60 text-cyan-300 border-cyan-700/50',
  FIBER:    'bg-green-950/60 text-green-300 border-green-700/50',
  MPLS:     'bg-orange-950/60 text-orange-300 border-orange-700/50',
  LTE:      'bg-yellow-950/60 text-yellow-300 border-yellow-700/50',
  VOIP:     'bg-teal-950/60 text-teal-300 border-teal-700/50',
  COLOC:    'bg-gray-800/60 text-gray-300 border-gray-600/50',
  HYBRID:   'bg-pink-950/60 text-pink-300 border-pink-700/50',
  DIA_ONLY: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50',
}

const SEVERITY_STYLE: Record<Severity, { row: string; badge: string; text: string; dot: string }> = {
  critical: { row: 'bg-red-950/30 border-red-800/30',       badge: 'bg-red-900 text-red-300',       text: 'text-red-400',    dot: 'bg-red-500' },
  warning:  { row: 'bg-orange-950/20 border-orange-800/20', badge: 'bg-orange-900 text-orange-300', text: 'text-orange-400', dot: 'bg-orange-400' },
  info:     { row: 'bg-gray-900/40 border-gray-800/20',     badge: 'bg-gray-800 text-gray-300',     text: 'text-gray-400',   dot: 'bg-gray-500' },
  resolved: { row: 'bg-green-950/20 border-green-800/20',   badge: 'bg-green-900 text-green-300',   text: 'text-green-400',  dot: 'bg-green-500' },
}

const STATE_STYLE: Record<SiteHealth['state'], { label: string; text: string; bg: string; dot: string }> = {
  up:       { label: 'UP',       text: 'text-green-400',  bg: 'bg-green-950/40 border-green-800/30',   dot: 'bg-green-400 dot-green' },
  degraded: { label: 'DEGRADED', text: 'text-yellow-400', bg: 'bg-yellow-950/30 border-yellow-800/30', dot: 'bg-yellow-400' },
  down:     { label: 'DOWN',     text: 'text-red-400',    bg: 'bg-red-950/40 border-red-800/30',       dot: 'bg-red-500 dot-red' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function rand(min: number, max: number) { return Math.random() * (max - min) + min }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)) }
function pickRand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

function buildSiteHealths(project: Project): SiteHealth[] {
  return project.sites.slice(0, 30).map(site => {
    const providers = Object.keys(site.dias) as Provider[]
    const provider  = providers.length > 0 ? providers[0] : getCarrierForCountry(site.country)
    const stability = Math.random()
    const state: SiteHealth['state'] = stability > 0.85 ? 'down' : stability > 0.65 ? 'degraded' : 'up'
    return {
      siteId:      site.id,
      siteName:    site.name,
      country:     site.country,
      provider,
      refreshType: site.refreshType,
      state,
      stability,
      latency: state === 'down' ? 999 : state === 'degraded' ? randInt(90, 280) : randInt(8, 55),
      jitter:  state === 'down' ? 999 : state === 'degraded' ? randInt(25, 80)  : randInt(1, 12),
      loss:    state === 'down' ? 100  : state === 'degraded' ? rand(1, 8)      : rand(0, 0.3),
      uptime:  state === 'down' ? rand(70, 88) : state === 'degraded' ? rand(92, 98) : rand(99, 99.99),
    }
  })
}

function generateEvent(healths: SiteHealth[]): NetEvent {
  const weighted = [
    ...healths.filter(h => h.state === 'down').flatMap(h => [h, h, h, h]),
    ...healths.filter(h => h.state === 'degraded').flatMap(h => [h, h]),
    ...healths.filter(h => h.state === 'up'),
  ]
  const site = pickRand(weighted.length > 0 ? weighted : healths)

  const techKey = site.refreshType ?? 'default'
  const pool = TECH_POOLS[techKey] ?? TECH_POOLS.default
  const typePool = site.state === 'down' ? pool.down : site.state === 'degraded' ? pool.degraded : pool.up

  const type = pickRand(typePool)
  const tmpl = T[type]
  const jh = {
    ...site,
    latency: Math.max(1, site.latency + randInt(-8, 15)),
    jitter:  Math.max(0, site.jitter  + randInt(-3, 8)),
    loss:    Math.max(0, site.loss    + rand(-0.2, 0.5)),
  }

  return {
    id: `${Date.now()}_${Math.random()}`,
    ts: new Date(),
    siteId:      site.siteId,
    siteName:    site.siteName,
    country:     site.country,
    provider:    site.provider,
    refreshType: site.refreshType,
    type,
    severity: tmpl.severity,
    message:  tmpl.msgFn(jh),
    metric:   tmpl.metricFn?.(jh),
  }
}

function fmt(d: Date) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Component ─────────────────────────────────────────────────────────────────
const MAX_EVENTS = 120
type FilterType = 'all' | Severity

interface Props { project: Project }

export function NetworkMonitor({ project }: Props) {
  const [healths]  = useState<SiteHealth[]>(() => buildSiteHealths(project))
  const [events,  setEvents]  = useState<NetEvent[]>([])
  const [paused,  setPaused]  = useState(false)
  const [filter,  setFilter]  = useState<FilterType>('all')
  const feedRef   = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  pausedRef.current = paused

  const scrollTop = useCallback(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0
  }, [])

  useEffect(() => {
    const seed: NetEvent[] = []
    for (let i = 0; i < 8; i++) seed.push(generateEvent(healths))
    setEvents(seed)

    const timer = setInterval(() => {
      if (pausedRef.current) return
      setEvents(prev => [generateEvent(healths), ...prev].slice(0, MAX_EVENTS))
      scrollTop()
    }, 2800)

    return () => clearInterval(timer)
  }, [healths, scrollTop])

  const filtered = filter === 'all' ? events : events.filter(e => e.severity === filter)
  const counts = {
    critical: events.filter(e => e.severity === 'critical').length,
    warning:  events.filter(e => e.severity === 'warning').length,
    resolved: events.filter(e => e.severity === 'resolved').length,
    info:     events.filter(e => e.severity === 'info').length,
  }

  const sitesDown     = healths.filter(h => h.state === 'down').length
  const sitesDegraded = healths.filter(h => h.state === 'degraded').length
  const sitesUp       = healths.filter(h => h.state === 'up').length

  return (
    <div className="space-y-5">

      {/* Demo notice */}
      <div className="flex items-center gap-3 bg-blue-950/40 border border-blue-800/40 rounded-xl px-4 py-2.5">
        <Radio className="w-4 h-4 text-blue-400 flex-shrink-0 animate-pulse" />
        <p className="text-xs text-blue-200">
          <span className="font-semibold">Simulated live feed</span> — events are technology-aware (SD-WAN, SAP, Wi-Fi, MPLS, Fiber, LTE, VoIP). In production, connect via the <span className="font-mono text-blue-300">/api/events</span> webhook.
        </p>
      </div>

      {/* Site health summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Sites Up',         value: sitesUp,       icon: CheckCircle,  color: 'text-green-400',  bg: 'bg-green-950/30 border-green-800/30' },
          { label: 'Degraded',         value: sitesDegraded, icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-950/30 border-yellow-800/30' },
          { label: 'Down / No Signal', value: sitesDown,     icon: WifiOff,      color: 'text-red-400',    bg: 'bg-red-950/30 border-red-800/30' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-xl border px-4 py-3 ${bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className={`text-xs font-semibold ${color}`}>{label}</span>
            </div>
            <div className={`text-3xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">of {healths.length} monitored</div>
          </div>
        ))}
      </div>

      {/* Site health grid */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Circuit Health — Per Site</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {healths.map(h => {
            const ss = STATE_STYLE[h.state]
            const techBadge = h.refreshType ? TECH_BADGE[h.refreshType] : null
            return (
              <div key={h.siteId} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${ss.bg}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ss.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-white truncate">{h.siteName}</span>
                    {techBadge && h.refreshType && (
                      <span className={`text-xs px-1.5 py-0 rounded border font-semibold ${techBadge}`} style={{ fontSize: '10px' }}>
                        {h.refreshType}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">{h.country} · {h.provider}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                  <span className={`font-semibold ${ss.text}`}>{ss.label}</span>
                  {h.state !== 'down' && (
                    <>
                      <span className="text-gray-500">{h.latency}ms</span>
                      {h.loss > 0.1 && <span className="text-orange-400">{h.loss.toFixed(1)}%</span>}
                    </>
                  )}
                  <span className="text-gray-600">{h.uptime.toFixed(2)}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Event feed controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider mr-1">Filter:</span>
          {(['all', 'critical', 'warning', 'resolved', 'info'] as FilterType[]).map(f => (
            <button key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filter === f
                  ? f === 'critical' ? 'bg-red-900 border-red-700 text-red-200'
                  : f === 'warning'  ? 'bg-orange-900 border-orange-700 text-orange-200'
                  : f === 'resolved' ? 'bg-green-900 border-green-700 text-green-200'
                  : f === 'info'     ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-blue-900 border-blue-700 text-blue-200'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}>
              {f === 'all' ? `All (${events.length})` : `${f} (${counts[f as Severity] ?? 0})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline"
            onClick={() => setPaused(p => !p)}
            className={`h-7 text-xs border-gray-700 gap-1.5 ${paused ? 'text-green-400 border-green-700' : 'text-gray-300'}`}>
            {paused ? <><Play className="w-3 h-3" />Resume</> : <><Pause className="w-3 h-3" />Pause</>}
          </Button>
          <Button size="sm" variant="outline"
            onClick={() => setEvents([])}
            className="h-7 text-xs border-gray-700 text-gray-400 gap-1.5">
            <Trash2 className="w-3 h-3" />Clear
          </Button>
        </div>
      </div>

      {/* Live event feed */}
      <div className="card-glow bg-[#070d16] rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800 bg-[#0a0f1a]">
          <Activity className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-gray-300">Live Event Feed</span>
          {!paused && (
            <span className="flex items-center gap-1 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-400">LIVE</span>
            </span>
          )}
          {paused && <span className="text-xs text-yellow-400 ml-1">PAUSED</span>}
          <span className="ml-auto text-xs text-gray-600">{filtered.length} events</span>
        </div>

        <div ref={feedRef} className="overflow-y-auto max-h-[420px]">
          {filtered.length === 0 && (
            <div className="flex items-center justify-center py-12 text-gray-600 text-sm">No events yet…</div>
          )}
          {filtered.map((ev, i) => {
            const ss = SEVERITY_STYLE[ev.severity]
            const tb = ev.refreshType ? TECH_BADGE[ev.refreshType] : null
            return (
              <div key={ev.id}
                className={`flex items-start gap-3 px-4 py-2.5 border-b border-gray-800/40 last:border-0 ${ss.row}
                  ${i === 0 && !paused ? 'animate-in fade-in slide-in-from-top-1 duration-300' : ''}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${ss.dot}`} />
                <div className="w-20 flex-shrink-0 text-xs text-gray-500 mt-0.5 font-mono">{fmt(ev.ts)}</div>
                <div className="w-16 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ss.badge}`}>
                    {ev.severity.toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-white font-medium">{ev.message}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-500">{ev.siteName}</span>
                    <span className="text-gray-700">·</span>
                    <span className="text-xs text-gray-500">{ev.country}</span>
                    {tb && ev.refreshType && (
                      <>
                        <span className="text-gray-700">·</span>
                        <span className={`text-xs px-1.5 py-0 rounded border font-semibold ${tb}`} style={{ fontSize: '10px' }}>
                          {ev.refreshType}
                        </span>
                      </>
                    )}
                    {ev.metric && (
                      <>
                        <span className="text-gray-700">·</span>
                        <span className={`text-xs font-mono ${ss.text}`}>{ev.metric}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
