import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';

import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { ArrowRotateLeft } from 'iconsax-reactjs';
import { useIntl } from 'react-intl';

import { resetVastSetting, updateVastSettings, useGetVastSettings } from 'api/vastSettings';
import IconButton from 'components/@extended/IconButton';
import MainCard from 'components/MainCard';
import { HEADER_HEIGHT } from 'config';
import type { VastSetting } from 'types/vastSettings';

/**
 * Every @VastSetting a tenant can override, grouped by the settings class that declares it, one compact row per
 * field. The save bar is pinned under the app header so it never has to be scrolled to, however many settings there
 * are to page through above it.
 *
 * <p>A secret setting's field always starts empty: the value is never sent to this screen, only whether one is
 * configured. Saving it blank leaves whatever is already stored untouched, same as any other unedited field. The
 * reset icon clears a tenant's own override outright, falling back to the environment variable or compile-time
 * default the setting would otherwise use - the database override is what lets a tenant override either, and the
 * reset is what lets them stop.
 */
export default function VastSettingsPage() {
  const intl = useIntl();
  const { settings, settingsError, settingsLoading, reloadSettings } = useGetVastSettings();
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const seeded = useRef(false);

  useEffect(() => {
    if (seeded.current || !settings) {
      return;
    }
    seeded.current = true;
    setValues(Object.fromEntries(settings.map((setting) => [setting.settingKey, setting.value ?? ''])));
  }, [settings]);

  const groups = useMemo(() => {
    const byGroup = new Map<string, VastSetting[]>();
    (settings ?? []).forEach((setting) => {
      const group = byGroup.get(setting.group) ?? [];
      group.push(setting);
      byGroup.set(setting.group, group);
    });
    return Array.from(byGroup.entries());
  }, [settings]);

  const handleChange = (settingKey: string) => (event: ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [settingKey]: event.target.value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setActionError(null);
    try {
      const payload = Object.fromEntries((settings ?? []).map((setting) => [setting.settingKey, values[setting.settingKey] ?? '']));
      await updateVastSettings(payload);
      await reloadSettings();
      setSaved(true);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : intl.formatMessage({ id: 'vast-settings-save-error' }));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async (settingKey: string) => {
    setResetting(settingKey);
    setActionError(null);
    try {
      const response = await resetVastSetting(settingKey);
      const reset = response.settings.find((setting) => setting.settingKey === settingKey);
      setValues((prev) => ({ ...prev, [settingKey]: reset?.value ?? '' }));
      await reloadSettings();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : intl.formatMessage({ id: 'vast-settings-reset-error' }));
    } finally {
      setResetting(null);
    }
  };

  if (settingsLoading) {
    return (
      <Stack spacing={2}>
        {[0, 1].map((card) => (
          <MainCard key={card} contentSX={{ p: 1.5 }}>
            <Stack spacing={1.5}>
              <Skeleton height={24} width="30%" />
              <Skeleton height={40} />
              <Skeleton height={40} />
            </Stack>
          </MainCard>
        ))}
      </Stack>
    );
  }

  if (settingsError) {
    return (
      <MainCard>
        <Typography color="error">{intl.formatMessage({ id: 'vast-settings-error' })}</Typography>
      </MainCard>
    );
  }

  return (
    <MainCard content={false} sx={{ overflow: 'visible' }}>
      <CardActions
        sx={{
          position: 'sticky',
          top: HEADER_HEIGHT,
          zIndex: 1,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderBottomColor: 'divider',
          borderTopLeftRadius: (theme) => theme.shape.borderRadius,
          borderTopRightRadius: (theme) => theme.shape.borderRadius,
          py: 1
        }}
      >
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', width: 1, gap: 2 }}>
          <Box sx={{ minHeight: 24 }}>
            {actionError && (
              <Alert severity="error" sx={{ py: 0 }} onClose={() => setActionError(null)}>
                {actionError}
              </Alert>
            )}
            {!actionError && saved && (
              <Alert severity="success" sx={{ py: 0 }} onClose={() => setSaved(false)}>
                {intl.formatMessage({ id: 'vast-settings-saved' })}
              </Alert>
            )}
          </Box>
          <Button variant="contained" onClick={handleSave} disabled={saving || groups.length === 0} sx={{ flexShrink: 0 }}>
            {intl.formatMessage({ id: 'vast-settings-save' })}
          </Button>
        </Stack>
      </CardActions>

      <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Stack spacing={1.5}>
          {groups.map(([group, groupSettings]) => (
            <MainCard key={group} title={group} contentSX={{ p: 0 }}>
              <Stack divider={<Divider />}>
                {groupSettings.map((setting) => (
                  <Stack key={setting.settingKey} direction="row" spacing={1.5} sx={{ alignItems: 'center', px: 2, py: 1 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ width: 200, flexShrink: 0 }}>
                      {setting.label}
                    </Typography>
                    <TextField
                      size="small"
                      type={setting.secret ? 'password' : 'text'}
                      value={values[setting.settingKey] ?? ''}
                      onChange={handleChange(setting.settingKey)}
                      placeholder={
                        setting.secret
                          ? intl.formatMessage({ id: setting.configured ? 'vast-settings-secret-set' : 'vast-settings-secret-unset' })
                          : undefined
                      }
                      fullWidth
                    />
                    <Tooltip title={intl.formatMessage({ id: 'vast-settings-reset' })}>
                      <Box component="span">
                        <IconButton
                          size="small"
                          color="secondary"
                          disabled={!setting.configured || resetting === setting.settingKey}
                          onClick={() => handleReset(setting.settingKey)}
                          aria-label={intl.formatMessage({ id: 'vast-settings-reset' })}
                        >
                          <ArrowRotateLeft size={16} />
                        </IconButton>
                      </Box>
                    </Tooltip>
                  </Stack>
                ))}
              </Stack>
            </MainCard>
          ))}

          {groups.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              {intl.formatMessage({ id: 'vast-settings-none' })}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </MainCard>
  );
}
