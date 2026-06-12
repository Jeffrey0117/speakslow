import React, { useState } from "react";
import { Mic, Shield, Settings } from "lucide-react";
import { usePermissions } from "../hooks/usePermissions";
import PermissionCard from "./ui/permission-card";
import HotkeySettings from "./HotkeySettings";
import { toast } from "sonner";
import { useTranslation } from "../i18n";

const SettingsPanel = ({ onClose }) => {
  const { t } = useTranslation();
  const showAlert = (alert) => {
    toast(alert.title, {
      description: alert.description,
      duration: 4000,
    });
  };

  const {
    micPermissionGranted,
    accessibilityPermissionGranted,
    requestMicPermission,
    testAccessibilityPermission,
  } = usePermissions(showAlert);


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* 标题栏 */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 chinese-title">{t('settings.title')}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <span className="text-gray-500 dark:text-gray-400 text-xl">×</span>
          </button>
        </div>

        {/* 内容区域 */}
        <div className="p-6 space-y-8">
          {/* 权限部分 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 chinese-title">
              {t('settings.permissions')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              {t('settings.permissionsDesc')}
            </p>

            <div className="space-y-4">
              <PermissionCard
                icon={Mic}
                title={t('settings.micPermission')}
                description={t('settings.micPermissionDesc')}
                granted={micPermissionGranted}
                onRequest={requestMicPermission}
                buttonText={t('settings.testMic')}
              />

              <PermissionCard
                icon={Shield}
                title={t('settings.accessibilityPermission')}
                description={t('settings.accessibilityPermissionDesc')}
                granted={accessibilityPermissionGranted}
                onRequest={testAccessibilityPermission}
                buttonText={t('settings.testPermission')}
              />
            </div>
          </div>

          {/* 快捷鍵設定部分 */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
            <HotkeySettings />
          </div>

          {/* 应用信息部分 */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 chinese-title">
              {t('settings.about')}
            </h3>
            <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/30 dark:to-green-900/30 p-4 rounded-lg">
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                <strong>{t('settings.brandFull')}</strong> - {t('settings.aboutDesc')}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                • {t('settings.features.recognition')}<br/>
                • {t('settings.features.ai')}<br/>
                • {t('settings.features.realtime')}<br/>
                • {t('settings.features.privacy')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;