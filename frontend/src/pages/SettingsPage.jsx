import { useState } from 'react';
import { Save, Building2, User, Bell, Shield, Database } from 'lucide-react';
import { Card, useToast, Toast } from '../components/common/UI';
import { loadSettings, saveSettings } from '../services/api';

const TABS = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'profile', label: 'Analyst Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'detection', label: 'Detection', icon: Shield },
  { id: 'retention', label: 'Data Retention', icon: Database },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [activeTab, setActiveTab] = useState('general');
  const { toast, show, done } = useToast();

  const update = (patch) => setSettings((s) => ({ ...s, ...patch }));

  const onSave = () => {
    saveSettings(settings);
    show('Settings saved', 'success');
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">
            Configure platform behavior and analyst preferences
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={onSave}>
            <Save size={14} /> Save changes
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 20 }}>
        <Card className="" >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className="nav-item"
                  style={{
                    background: active ? 'var(--bg-hover)' : 'transparent',
                    color: active ? 'var(--brand-300)' : 'var(--text-secondary)',
                    border: 'none',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <span className="nav-item-icon">
                    <Icon size={15} />
                  </span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </Card>

        <div>
          {activeTab === 'general' && (
            <Card title="Organization" subtitle="Platform identity">
              <div className="form-group">
                <label className="form-label">Organization name</label>
                <input
                  className="form-input"
                  type="text"
                  value={settings.organization}
                  onChange={(e) => update({ organization: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Default analyst</label>
                  <input
                    className="form-input"
                    type="text"
                    value={settings.analyst}
                    onChange={(e) => update({ analyst: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Dashboard refresh (sec)</label>
                  <input
                    className="form-input"
                    type="number"
                    min="5"
                    max="300"
                    value={settings.refreshIntervalSec}
                    onChange={(e) =>
                      update({ refreshIntervalSec: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'profile' && (
            <Card title="Analyst Profile" subtitle="Your SOC identity">
              <div className="detail-row">
                <div className="detail-label">Display name</div>
                <div className="detail-value">{settings.analyst}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">Role</div>
                <div className="detail-value">SOC Analyst — Tier 2</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">Organization</div>
                <div className="detail-value">{settings.organization}</div>
              </div>
              <div className="detail-row">
                <div className="detail-label">Default timezone</div>
                <div className="detail-value">
                  {Intl.DateTimeFormat().resolvedOptions().timeZone}
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'notifications' && (
            <Card title="Notifications" subtitle="How you want to be alerted">
              <div className="toggle-row">
                <div className="toggle-row-text">
                  <strong>Email notifications</strong>
                  <span>Receive email for high and critical severity alerts.</span>
                </div>
                <div
                  className={'toggle-switch' + (settings.emailNotifications ? ' on' : '')}
                  onClick={() => update({ emailNotifications: !settings.emailNotifications })}
                />
              </div>
              <div className="toggle-row">
                <div className="toggle-row-text">
                  <strong>Slack notifications</strong>
                  <span>Post critical alerts to the #soc-alerts channel.</span>
                </div>
                <div
                  className={'toggle-switch' + (settings.slackNotifications ? ' on' : '')}
                  onClick={() => update({ slackNotifications: !settings.slackNotifications })}
                />
              </div>
              <div className="toggle-row">
                <div className="toggle-row-text">
                  <strong>Auto-block critical sources</strong>
                  <span>Push firewall rules automatically for critical severity alerts.</span>
                </div>
                <div
                  className={'toggle-switch' + (settings.autoBlockCritical ? ' on' : '')}
                  onClick={() => update({ autoBlockCritical: !settings.autoBlockCritical })}
                />
              </div>
            </Card>
          )}

          {activeTab === 'detection' && (
            <Card title="Detection Settings" subtitle="Defaults for new signatures">
              <div className="form-group">
                <label className="form-label">Default severity</label>
                <select
                  className="form-select"
                  value={settings.defaultSeverity}
                  onChange={(e) => update({ defaultSeverity: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="toggle-row">
                <div className="toggle-row-text">
                  <strong>Auto-enable new signatures</strong>
                  <span>New rules become active immediately on save.</span>
                </div>
                <div
                  className={'toggle-switch' + (settings.autoEnable ? ' on' : '')}
                  onClick={() => update({ autoEnable: !settings.autoEnable })}
                />
              </div>
            </Card>
          )}

          {activeTab === 'retention' && (
            <Card title="Data Retention" subtitle="How long data is kept">
              <div className="form-group">
                <label className="form-label">Log retention (days)</label>
                <input
                  className="form-input"
                  type="number"
                  min="7"
                  max="365"
                  value={settings.retentionDays}
                  onChange={(e) => update({ retentionDays: Number(e.target.value) })}
                />
                <div className="form-error" style={{ color: 'var(--text-tertiary)' }}>
                  Logs older than this are archived to cold storage.
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Alert retention (days)</label>
                <input
                  className="form-input"
                  type="number"
                  defaultValue={90}
                  min="30"
                  max="730"
                />
              </div>
            </Card>
          )}
        </div>
      </div>

      <Toast {...toast} onDone={done} />
    </>
  );
}
