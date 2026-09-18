import {
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatShortDay } from '../../utils/format';

export default function ThreatTrendChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="threats" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff3b5c" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#ff3b5c" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="anomalies" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffc233" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#ffc233" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="normal" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4de5ff" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#4de5ff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2942" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatShortDay}
          stroke="#6b7a96"
          fontSize={11}
          tickLine={false}
          axisLine={{ stroke: '#1e2942' }}
        />
        <YAxis
          stroke="#6b7a96"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          contentStyle={{
            background: '#141b2e',
            border: '1px solid #2a3654',
            borderRadius: 6,
            fontSize: 12,
            color: '#e6edf7',
          }}
          labelFormatter={formatShortDay}
        />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 6 }}
          iconType="circle"
          iconSize={8}
        />
        <Area
          type="monotone"
          dataKey="normal"
          name="Normal"
          stroke="#4de5ff"
          strokeWidth={1.5}
          fill="url(#normal)"
        />
        <Area
          type="monotone"
          dataKey="anomalies"
          name="Anomalies"
          stroke="#ffc233"
          strokeWidth={1.5}
          fill="url(#anomalies)"
        />
        <Area
          type="monotone"
          dataKey="threats"
          name="Threats"
          stroke="#ff3b5c"
          strokeWidth={2}
          fill="url(#threats)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
