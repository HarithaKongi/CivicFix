'use client'

import { useEffect } from 'react'
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type PublicIssue = { _id: string; title: string; referenceNumber: string; latitude: number; longitude: number; address: string; status: string; categoryName?: string }
const icon = L.icon({ iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png', iconSize: [25, 41], iconAnchor: [12, 41] })
function FitBounds({ issues }: { issues: PublicIssue[] }) { const map = useMap(); useEffect(() => { if (issues.length) map.fitBounds(issues.map((issue) => [issue.latitude, issue.longitude] as [number, number]), { padding: [24, 24] }) }, [issues, map]); return null }
export function PublicIssueMap({ issues }: { issues: PublicIssue[] }) { const center: [number, number] = issues[0] ? [issues[0].latitude, issues[0].longitude] : [37.7749, -122.4194]; return <MapContainer center={center} zoom={12} scrollWheelZoom className="h-[min(70vh,560px)] min-h-80 w-full rounded-2xl" aria-label="Public CivicFix issue map"><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><FitBounds issues={issues}/>{issues.map((issue) => <Marker key={issue._id} position={[issue.latitude, issue.longitude]} icon={icon}><Popup><div className="min-w-44"><p className="text-xs font-semibold text-slate-400">{issue.referenceNumber}</p><h3 className="mt-1 font-semibold text-slate-900">{issue.title}</h3><p className="mt-1 text-xs text-slate-500">{issue.categoryName ?? 'Community report'} · {issue.status.replaceAll('_', ' ').toLowerCase()}</p><p className="mt-1 text-xs text-slate-500">{issue.address}</p></div></Popup></Marker>)}</MapContainer> }

