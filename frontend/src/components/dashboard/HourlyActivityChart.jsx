import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

export default function HourlyActivityChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e2942" vertical={false} />
        <XAxis
          dataKey="hour"
          stroke="#6b7a96"
          fontSize={10}
          tickLine={false}
          axisLine={{ stroke: '#1e2942' }}
          interval={3}
        />
        <YAxis
          stroke="#6b7a96"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
          contentStyle={{
            background: '#141b2e',
            border: '1px solid #2a3654',
            borderRadius: 6,
            fontSize: 12,
            color: '#e6edf7',
          }}
        />
        <Bar dataKey="logs" name="Logs / hr" fill="#4de5ff" radius={[3, 3, 0, 0]} />
        <Bar dataKey="threats" name="Threats / hr" fill="#ff3b5c" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
