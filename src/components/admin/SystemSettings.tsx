import React, { useState } from 'react';
import { 
  Shield, 
  Bell, 
  Palette, 
  Globe, 
  Mail, 
  Key, 
  Clock, 
  Database,
  Upload,
  SaveAll,
  AlertCircle
} from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/components/ui/use-toast";

const SystemSettings: React.FC = () => {
  // General Settings
  const [siteName, setSiteName] = useState('XSM Market');
  const [siteDescription, setSiteDescription] = useState('Your trusted marketplace for everything');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maxFileSize, setMaxFileSize] = useState(10); // MB

  // Security Settings
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [passwordExpiry, setPasswordExpiry] = useState(90); // days
  const [loginAttempts, setLoginAttempts] = useState(5);
  const [strongPasswords, setStrongPasswords] = useState(true);

  // Notification Settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [adminAlerts, setAdminAlerts] = useState(true);
  const [reportNotifications, setReportNotifications] = useState(true);

  // Appearance Settings
  const [darkMode, setDarkMode] = useState(true);
  const [compactMode, setCompactMode] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(true);

  const handleSaveSettings = () => {
    // Mock API call to save settings
    toast({
      title: "Settings Saved",
      description: "Your system settings have been updated successfully.",
      variant: "default",
    });
  };

  return (
    <div className="p-6 bg-xsm-black min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-xsm-yellow">System Settings</h2>
          <button
            onClick={handleSaveSettings}
            className="flex items-center gap-2 bg-xsm-yellow hover:bg-yellow-500 text-black px-4 py-2 rounded-lg transition-colors"
          >
            <SaveAll className="w-5 h-5" />
            Save Changes
          </button>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {/* General Settings */}
          <AccordionItem value="general" className="bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-xsm-yellow" />
                <span className="text-lg font-medium">General Settings</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <label className="text-sm text-xsm-light-gray">Site Name</label>
                  <input
                    type="text"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    className="w-full bg-xsm-black border border-xsm-medium-gray rounded-lg px-4 py-2 focus:outline-none focus:border-xsm-yellow text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-xsm-light-gray">Site Description</label>
                  <textarea
                    value={siteDescription}
                    onChange={(e) => setSiteDescription(e.target.value)}
                    className="w-full bg-xsm-black border border-xsm-medium-gray rounded-lg px-4 py-2 focus:outline-none focus:border-xsm-yellow text-white"
                    rows={3}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm">Maintenance Mode</div>
                    <div className="text-xs text-xsm-light-gray">Temporarily disable the site for maintenance</div>
                  </div>
                  <Switch 
                    checked={maintenanceMode}
                    onCheckedChange={setMaintenanceMode}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-xsm-light-gray">Maximum File Upload Size (MB)</label>
                  <Slider
                    value={[maxFileSize]}
                    onValueChange={(value) => setMaxFileSize(value[0])}
                    max={50}
                    min={1}
                    step={1}
                  />
                  <div className="text-sm text-xsm-light-gray">{maxFileSize} MB</div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Security Settings */}
          <AccordionItem value="security" className="bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-xsm-yellow" />
                <span className="text-lg font-medium">Security Settings</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm">Two-Factor Authentication</div>
                    <div className="text-xs text-xsm-light-gray">Require 2FA for all admin accounts</div>
                  </div>
                  <Switch 
                    checked={twoFactorAuth}
                    onCheckedChange={setTwoFactorAuth}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-xsm-light-gray">Password Expiry (Days)</label>
                  <Slider
                    value={[passwordExpiry]}
                    onValueChange={(value) => setPasswordExpiry(value[0])}
                    max={180}
                    min={30}
                    step={30}
                  />
                  <div className="text-sm text-xsm-light-gray">{passwordExpiry} days</div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-xsm-light-gray">Max Login Attempts</label>
                  <Slider
                    value={[loginAttempts]}
                    onValueChange={(value) => setLoginAttempts(value[0])}
                    max={10}
                    min={3}
                    step={1}
                  />
                  <div className="text-sm text-xsm-light-gray">{loginAttempts} attempts</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm">Strong Password Policy</div>
                    <div className="text-xs text-xsm-light-gray">Enforce complex password requirements</div>
                  </div>
                  <Switch 
                    checked={strongPasswords}
                    onCheckedChange={setStrongPasswords}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Notification Settings */}
          <AccordionItem value="notifications" className="bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-xsm-yellow" />
                <span className="text-lg font-medium">Notification Settings</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm">Email Notifications</div>
                    <div className="text-xs text-xsm-light-gray">Send system notifications via email</div>
                  </div>
                  <Switch 
                    checked={emailNotifications}
                    onCheckedChange={setEmailNotifications}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm">Push Notifications</div>
                    <div className="text-xs text-xsm-light-gray">Enable browser push notifications</div>
                  </div>
                  <Switch 
                    checked={pushNotifications}
                    onCheckedChange={setPushNotifications}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm">Admin Alerts</div>
                    <div className="text-xs text-xsm-light-gray">Receive critical system alerts</div>
                  </div>
                  <Switch 
                    checked={adminAlerts}
                    onCheckedChange={setAdminAlerts}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm">Report Notifications</div>
                    <div className="text-xs text-xsm-light-gray">Get notified of new user reports</div>
                  </div>
                  <Switch 
                    checked={reportNotifications}
                    onCheckedChange={setReportNotifications}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Appearance Settings */}
          <AccordionItem value="appearance" className="bg-xsm-dark-gray rounded-xl border border-xsm-medium-gray px-6">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-xsm-yellow" />
                <span className="text-lg font-medium">Appearance Settings</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-4">
              <div className="grid gap-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm">Dark Mode</div>
                    <div className="text-xs text-xsm-light-gray">Enable dark mode by default</div>
                  </div>
                  <Switch 
                    checked={darkMode}
                    onCheckedChange={setDarkMode}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm">Compact Mode</div>
                    <div className="text-xs text-xsm-light-gray">Reduce spacing in the interface</div>
                  </div>
                  <Switch 
                    checked={compactMode}
                    onCheckedChange={setCompactMode}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-sm">Enable Animations</div>
                    <div className="text-xs text-xsm-light-gray">Show interface animations</div>
                  </div>
                  <Switch 
                    checked={animationsEnabled}
                    onCheckedChange={setAnimationsEnabled}
                  />
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSaveSettings}
            className="flex items-center gap-2 bg-xsm-yellow hover:bg-yellow-500 text-black px-6 py-2 rounded-lg transition-colors"
          >
            <SaveAll className="w-5 h-5" />
            Save All Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;
