'use client';

import React, { useState } from 'react';
import {
  Instagram,
  AtSign,
  Facebook,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Info,
  Key,
  ShieldCheck,
  Smartphone,
  Copy,
  Check,
  Layers,
  BookOpen,
  ArrowRight,
  Maximize2,
  X,
  Compass,
  FileText,
  Lock,
  Globe,
  Settings,
} from 'lucide-react';

interface GuideStep {
  number: number;
  title: string;
  badge?: string;
  badgeType?: 'info' | 'warning' | 'success' | 'danger';
  description: string;
  details?: string[];
  imageSrc?: string;
  imageCaption?: string;
  codeSnippet?: string;
  importantNote?: string;
  links?: { label: string; url: string }[];
}

export function MetaConnectionGuideView() {
  const [activePlatform, setActivePlatform] = useState<'instagram' | 'threads' | 'facebook' | 'links'>('instagram');
  const [zoomImage, setZoomImage] = useState<{ src: string; caption: string } | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const instagramSteps: GuideStep[] = [
    {
      number: 1,
      title: 'Open Meta Developer Portal and Select App',
      description: 'Navigate to your Meta app dashboard. All Instagram and Threads settings are managed under this app.',
      details: [
        'Log into developers.facebook.com with your Meta developer account.',
        'Select your app (Meta App ID: 1125007820131674).',
      ],
      links: [
        { label: 'Meta Developer Portal', url: 'https://developers.facebook.com/apps/' },
        { label: 'App Dashboard (1125007820131674)', url: 'https://developers.facebook.com/apps/1125007820131674/dashboard/' },
      ],
    },
    {
      number: 2,
      title: 'Navigate to Instagram Business Login Settings',
      description: 'Open the Use Cases section for Instagram. Do not confuse this with Facebook Login settings or Webhooks.',
      details: [
        'In the left sidebar, click Use cases.',
        'Find "Manage messaging and content on Instagram" and click Customize.',
        'Locate Section 4: "Set up Instagram business login" and click the blue Set up button.',
      ],
      imageSrc: '/guides/instagram-business-login-setup.jpg',
      imageCaption: 'Section 4: Click the blue "Set up" button under "Set up Instagram business login" (Do not use Webhooks in Section 3).',
      importantNote: 'Section 3 is for Webhooks (event streams), which requires a secret verify token. OAuth redirect must be configured strictly in Section 4.',
      links: [
        {
          label: 'Direct Link to Instagram Business Setup',
          url: 'https://developers.facebook.com/apps/1125007820131674/use-cases/customize/?use_case_enum=INSTAGRAM_BASIC_EXECUTION',
        },
      ],
    },
    {
      number: 3,
      title: 'Register the HTTPS Redirect Callback URI',
      description: 'Meta strictly enforces HTTPS for Instagram Login redirect URLs. Plain HTTP localhost URLs will be rejected with an error.',
      codeSnippet: 'https://localhost:3000/auth/instagram/callback',
      imageSrc: '/guides/instagram-redirect-uri-modal.jpg',
      imageCaption: 'Enter https://localhost:3000/auth/instagram/callback in the Redirect URL field and click Save.',
      importantNote: 'If you enter http://localhost:3000, Meta displays "Error saving redirect URIs". Always use https://.',
      details: [
        'Paste https://localhost:3000/auth/instagram/callback into the Redirect URL box.',
        'Click Save. Meta will confirm with "Changes saved".',
        'Ensure INSTAGRAM_REDIRECT_URI in your .env matches this exact string.',
      ],
    },
    {
      number: 4,
      title: 'Add Account as an Instagram Tester (Development Mode)',
      description: 'While your Meta app is unpublished in Development Mode, each personal account must be added as a Tester.',
      details: [
        'In the left menu, go to App roles > Roles.',
        'Click + Add People on the top right.',
        'Select the role "Instagram Tester".',
        'Enter your Instagram handle (e.g. flimyapper, cinemonster.in) and submit.',
      ],
      imageSrc: '/guides/meta-app-roles-testers.jpg',
      imageCaption: 'App Roles table showing accounts registered as Instagram Testers and Threads Testers.',
      links: [
        { label: 'Manage App Roles', url: 'https://developers.facebook.com/apps/1125007820131674/roles/' },
        { label: 'Instagram Manage Access (Accept Invites)', url: 'https://www.instagram.com/accounts/manage_access/' },
      ],
      importantNote: 'After sending the invite, open instagram.com/accounts/manage_access/ in your browser, switch to the "Tester Invites" tab, and click Accept.',
    },
    {
      number: 5,
      title: 'Connect and Authorize in VideoTimmer',
      description: 'Trigger direct OAuth from VideoTimmer. To connect a second or third account, use a private window.',
      details: [
        'Open VideoTimmer at https://localhost:3000/?tab=instagram-composer.',
        'Click Connect Instagram Account.',
        'Meta will prompt you to authorize your professional Instagram profile. Click Allow.',
        'To connect another account (@cinemonster.in, @monish.insider): open an Incognito window, sign into the other account on instagram.com, and trigger the auth URL.',
      ],
      links: [
        { label: 'Open Instagram Composer', url: '/?tab=instagram-composer' },
      ],
    },
  ];

  const threadsSteps: GuideStep[] = [
    {
      number: 1,
      title: 'Add Threads API Use Case & Content Publishing Scope',
      description: 'Threads requires the dedicated publishing permission threads_content_publish to be added to the use case.',
      details: [
        'In the Meta Developer Dashboard, click Use cases > Access the Threads API.',
        'Under "Permissions and features", locate threads_content_publish.',
        'Click the + Add button next to threads_content_publish.',
      ],
      imageSrc: '/guides/threads-permissions-setup.jpg',
      imageCaption: 'Permissions table: ensure threads_content_publish is added so VideoTimmer can publish posts.',
      importantNote: 'If threads_content_publish is missing, Meta returns: "Unsupported post request. Object with ID does not exist, cannot be loaded due to missing permissions".',
      links: [
        {
          label: 'Direct Link to Threads API Permissions',
          url: 'https://developers.facebook.com/apps/1125007820131674/use-cases/customize/?use_case_enum=THREADS_API',
        },
      ],
    },
    {
      number: 2,
      title: 'Retrieve Dedicated Threads App ID and Secret',
      description: 'Threads uses its own distinct App ID and Secret, separate from the main Facebook Meta App ID.',
      details: [
        'In the left sub-panel under "Access the Threads API", click Settings.',
        'Copy the numeric "Threads app ID" (e.g. 4691026264551658).',
        'Click Show next to "Threads app secret" and copy the secret string.',
        'Add the Redirect Callback URL: https://localhost:3000/auth/threads/callback.',
        'Click Save at the bottom right.',
      ],
      imageSrc: '/guides/threads-settings-credentials.jpg',
      imageCaption: 'Threads Settings screen showing dedicated Threads App ID, App Secret, and Redirect Callback URLs.',
      importantNote: 'Never use the top-level Meta App ID (1125007820131674) for Threads. Always use the dedicated Threads App ID.',
    },
    {
      number: 3,
      title: 'Update .env File in VideoTimmer',
      description: 'Store the dedicated Threads credentials in your local environment file.',
      codeSnippet: `THREADS_APP_ID=4691026264551658\nTHREADS_APP_SECRET=YOUR_THREADS_APP_SECRET\nTHREADS_REDIRECT_URI=https://localhost:3000/auth/threads/callback`,
      details: [
        'Open your project .env file.',
        'Ensure THREADS_APP_ID contains the dedicated Threads ID.',
        'Ensure THREADS_REDIRECT_URI matches https://localhost:3000/auth/threads/callback.',
      ],
    },
    {
      number: 4,
      title: 'Add Account as a "Threads Tester" in App Roles',
      description: 'Threads Tester is an independent role distinct from Instagram Tester. Both must be added separately.',
      details: [
        'Go to App roles > Roles in the developer dashboard.',
        'Click + Add People.',
        'Choose the role "Threads Tester" (not Instagram Tester).',
        'Enter your Threads handle (flimyapper) and submit.',
      ],
      imageSrc: '/guides/meta-app-roles-testers.jpg',
      imageCaption: 'Roles page showing flimyapper registered as both an Instagram Tester and a Threads Tester.',
      links: [
        { label: 'Meta App Roles Dashboard', url: 'https://developers.facebook.com/apps/1125007820131674/roles/' },
      ],
    },
    {
      number: 5,
      title: 'Accept the Invitation in the Threads Mobile App',
      description: 'Threads invites do not appear on desktop web settings. They must be accepted in the mobile app.',
      details: [
        'Open the Threads mobile app on your iPhone or Android phone.',
        'Go to Profile > tap the two horizontal lines (top right) to open Settings.',
        'Do not click Meta Accounts Center. Scroll down to Account.',
        'Tap Website permissions > Invites tab.',
        'Find New_automation and tap Approve (or Accept).',
      ],
      importantNote: 'Alternatively, accept on your computer via Instagram: open instagram.com/accounts/manage_access/ and click Accept under Tester Invites.',
      links: [
        { label: 'Instagram Manage Access (Desktop Alternative)', url: 'https://www.instagram.com/accounts/manage_access/' },
      ],
    },
    {
      number: 6,
      title: 'Connect & Publish in VideoTimmer',
      description: 'Authorize your account and begin publishing live threads directly from VideoTimmer.',
      details: [
        'Open https://localhost:3000/?tab=threads-composer in your browser.',
        'Click Connect Threads Account.',
        'Approve the permissions dialog in the popup window.',
        'VideoTimmer will store the long-lived token and display your active handle @flimyapper.',
        'Compose a post and click Publish Now as @flimyapper.',
      ],
      links: [
        { label: 'Open Threads Composer', url: '/?tab=threads-composer' },
        { label: 'View Live Test Post on Threads', url: 'https://threads.net/@flimyapper/post/18185165779426299' },
      ],
    },
  ];

  const facebookSteps: GuideStep[] = [
    {
      number: 1,
      title: 'Open Meta Developer Portal and Select App',
      description: 'Navigate to your Meta app dashboard. Facebook Pages and video publishing permissions are configured under this app.',
      details: [
        'Log into developers.facebook.com with your Meta developer account.',
        'Select your app (Meta App ID: 1125007820131674).',
        'Verify that your Facebook profile is listed as an Administrator or Developer under App Roles.',
      ],
      importantNote: 'Ensure you are the Admin or Editor of the Facebook Page you want to publish to.',
      links: [
        { label: 'Meta Developer App Dashboard', url: 'https://developers.facebook.com/apps/1125007820131674/dashboard/' },
      ],
    },
    {
      number: 2,
      title: 'Configure Facebook Login for Business & Page Permissions',
      description: 'Add or verify Facebook Login for Business and grant Page publishing permissions.',
      details: [
        'Navigate to Use Cases > Facebook Login for Business or Add Products > Facebook Login.',
        'Required permissions for publishing: pages_show_list, pages_read_engagement, pages_manage_posts, publish_video.',
        'In Development Mode, any Page owned by your admin/tester account can publish immediately without App Review.',
      ],
      importantNote: 'All 4 permissions are automatically requested during the one-click authorization flow.',
    },
    {
      number: 3,
      title: 'Add OAuth Redirect URI in Facebook Login Settings',
      description: 'Authorize VideoTimmer callback URLs so Meta safely returns Page access tokens.',
      details: [
        'Under Facebook Login > Settings, locate Valid OAuth Redirect URIs.',
        'Add: https://localhost:3000/auth/facebook/callback',
        'If running ngrok, add: https://your-subdomain.ngrok-free.dev/auth/facebook/callback',
        'Save Changes at the bottom of the page.',
      ],
      codeSnippet: 'https://localhost:3000/auth/facebook/callback',
    },
    {
      number: 4,
      title: 'One-Click Page Connection in VideoTimmer',
      description: 'Connect your Facebook Page with a single click and begin publishing Reels and videos.',
      details: [
        'Go to Facebook Studio in VideoTimmer and click "Connect via Facebook Login".',
        'Select the Facebook Page(s) you wish to manage.',
        'Grant permissions and return to VideoTimmer.',
        'Your Page will appear in the account selector with its live follower count ready for instant scheduling and publishing.',
      ],
      links: [
        { label: 'Open Facebook Studio', url: '/?tab=facebook-composer' },
      ],
    },
  ];

  const quickLinks = [
    {
      title: 'Meta Developer Portal',
      category: 'Meta Developer Platform',
      url: 'https://developers.facebook.com/apps/',
      description: 'Primary portal for managing apps, credentials, and API access.',
      icon: Globe,
    },
    {
      title: 'VideoTimmer Meta App Dashboard',
      category: 'App Credentials',
      url: 'https://developers.facebook.com/apps/1125007820131674/dashboard/',
      description: 'Dashboard for App ID 1125007820131674.',
      icon: Key,
    },
    {
      title: 'App Roles (Testers & Admins)',
      category: 'User Authorization',
      url: 'https://developers.facebook.com/apps/1125007820131674/roles/',
      description: 'Add Instagram and Threads accounts as authorized Testers in Development Mode.',
      icon: ShieldCheck,
    },
    {
      title: 'Instagram Business Login Settings',
      category: 'Instagram Setup',
      url: 'https://developers.facebook.com/apps/1125007820131674/use-cases/customize/?use_case_enum=INSTAGRAM_BASIC_EXECUTION',
      description: 'Configure Valid OAuth Redirect URIs under Section 4 for Direct Instagram Login.',
      icon: Instagram,
    },
    {
      title: 'Threads API Settings & Credentials',
      category: 'Threads Setup',
      url: 'https://developers.facebook.com/apps/1125007820131674/use-cases/customize/?use_case_enum=THREADS_API',
      description: 'Access dedicated Threads App ID, App Secret, and threads_content_publish scope.',
      icon: AtSign,
    },
    {
      title: 'Instagram Manage Access (Accept Invites)',
      category: 'Desktop Invite Approval',
      url: 'https://www.instagram.com/accounts/manage_access/',
      description: 'Accept tester invites for both Instagram and Threads directly from your computer.',
      icon: CheckCircle2,
    },
    {
      title: 'Live Threads Profile (@flimyapper)',
      category: 'Production Output',
      url: 'https://threads.net/@flimyapper',
      description: 'Live profile to verify published threads and engagement metrics.',
      icon: ExternalLink,
    },
  ];

  return (
    <div className="flex-1 bg-slate-900 text-slate-100 flex flex-col min-h-screen overflow-y-auto">
      {/* Top Header Banner */}
      <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-purple-600/20 text-purple-400 border border-purple-500/30">
                <Compass className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-white tracking-tight">
                Meta Account Connection Guide
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                Visual Reference
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-2xl">
              Complete walkthrough for configuring Meta Developer credentials, adding Instagram Creator/Business accounts, setting up Threads publishing, and resolving common authorization issues.
            </p>
          </div>

          {/* Quick Platform Switcher Tabs */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-2xl border border-slate-700/60 shrink-0">
            <button
              type="button"
              onClick={() => setActivePlatform('instagram')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                activePlatform === 'instagram'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-md shadow-pink-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Instagram className="w-4 h-4" />
              <span>Instagram Setup</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePlatform('threads')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                activePlatform === 'threads'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <AtSign className="w-4 h-4" />
              <span>Threads Setup</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePlatform('facebook')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                activePlatform === 'facebook'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Facebook className="w-4 h-4" />
              <span>Facebook Setup</span>
            </button>
            <button
              type="button"
              onClick={() => setActivePlatform('links')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
                activePlatform === 'links'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ExternalLink className="w-4 h-4" />
              <span>Important Links</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto p-6 flex-1 w-full space-y-6">
        {/* TAB 1: INSTAGRAM GUIDE */}
        {activePlatform === 'instagram' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Overview Card */}
            <div className="p-5 rounded-2xl border border-pink-500/20 bg-gradient-to-r from-pink-950/30 via-slate-900 to-purple-950/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-pink-300 flex items-center gap-2">
                  <Instagram className="w-4 h-4 text-pink-400" />
                  Instagram Login Architecture (Direct Instagram OAuth)
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Instagram App ID: 2559670657842668
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                VideoTimmer communicates directly with Meta Instagram Graph API endpoints (<code className="text-pink-300 font-mono">graph.instagram.com/v25.0</code>). 
                No Facebook Page selection or discovery is required. Each connected Instagram account maintains independent credentials, tokens, and publishing history.
              </p>
              <div className="pt-2 flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-300 font-mono">
                  Scope: instagram_business_basic
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-300 font-mono">
                  Scope: instagram_business_content_publish
                </span>
              </div>
            </div>

            {/* Step-by-Step Cards */}
            <div className="space-y-6">
              {instagramSteps.map((step) => (
                <div
                  key={step.number}
                  className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-md space-y-4 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-pink-600/20 border border-pink-500/40 text-pink-400 font-bold text-xs flex items-center justify-center shrink-0">
                        {step.number}
                      </span>
                      <h3 className="text-sm font-bold text-white tracking-wide">
                        {step.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed pl-10">
                    {step.description}
                  </p>

                  {/* Bullet points */}
                  {step.details && (
                    <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside pl-10">
                      {step.details.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  )}

                  {/* Code Snippet Box */}
                  {step.codeSnippet && (
                    <div className="ml-10 p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <code className="text-xs font-mono text-pink-300 break-all select-all">
                        {step.codeSnippet}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(step.codeSnippet!, `step-${step.number}`)}
                        className="ml-3 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1.5 transition-all shrink-0"
                      >
                        {copiedKey === `step-${step.number}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Important Alert Box */}
                  {step.importantNote && (
                    <div className="ml-10 p-3.5 rounded-xl bg-amber-950/20 border border-amber-600/30 flex items-start gap-2.5 text-xs text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">{step.importantNote}</p>
                    </div>
                  )}

                  {/* Visual Image Screenshot (Click to zoom) */}
                  {step.imageSrc && (
                    <div className="ml-10 space-y-2">
                      <div
                        onClick={() => setZoomImage({ src: step.imageSrc!, caption: step.imageCaption || step.title })}
                        className="relative group rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 cursor-pointer shadow-lg hover:border-pink-500/60 transition-all max-w-2xl"
                      >
                        <img
                          src={step.imageSrc}
                          alt={step.title}
                          className="w-full h-auto object-cover max-h-72 opacity-90 group-hover:opacity-100 transition-opacity"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-xs font-bold text-white backdrop-blur-[2px]">
                          <Maximize2 className="w-4 h-4" />
                          <span>Click to expand screenshot</span>
                        </div>
                      </div>
                      {step.imageCaption && (
                        <p className="text-[11px] text-slate-400 italic">
                          Reference: {step.imageCaption}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Quick Action Links */}
                  {step.links && (
                    <div className="ml-10 pt-2 flex flex-wrap gap-2">
                      {step.links.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-pink-300 hover:text-white transition-all shadow-sm"
                        >
                          <span>{link.label}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: THREADS GUIDE */}
        {activePlatform === 'threads' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Overview Card */}
            <div className="p-5 rounded-2xl border border-purple-500/20 bg-gradient-to-r from-purple-950/30 via-slate-900 to-indigo-950/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-purple-300 flex items-center gap-2">
                  <AtSign className="w-4 h-4 text-purple-400" />
                  Meta Threads API Architecture
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Threads App ID: 4691026264551658
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                VideoTimmer creates media containers via <code className="text-purple-300 font-mono">POST /me/threads</code> and publishes via <code className="text-purple-300 font-mono">POST /me/threads_publish</code>. 
                Using the <code className="text-purple-300 font-mono">/me</code> alias guarantees identity resolution and eliminates 64-bit integer overflow issues inherent to large Meta user IDs.
              </p>
              <div className="pt-2 flex flex-wrap gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono">
                  Scope: threads_basic
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono">
                  Scope: threads_content_publish
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 font-mono">
                  Scope: threads_read_replies
                </span>
              </div>
            </div>

            {/* Step-by-Step Cards */}
            <div className="space-y-6">
              {threadsSteps.map((step) => (
                <div
                  key={step.number}
                  className="p-5 rounded-2xl border border-slate-800 bg-slate-900/80 shadow-md space-y-4 hover:border-slate-700 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-xl bg-purple-600/20 border border-purple-500/40 text-purple-400 font-bold text-xs flex items-center justify-center shrink-0">
                        {step.number}
                      </span>
                      <h3 className="text-sm font-bold text-white tracking-wide">
                        {step.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed pl-10">
                    {step.description}
                  </p>

                  {/* Bullet points */}
                  {step.details && (
                    <ul className="text-xs text-slate-400 space-y-1.5 list-disc list-inside pl-10">
                      {step.details.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  )}

                  {/* Code Snippet Box */}
                  {step.codeSnippet && (
                    <div className="ml-10 p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <pre className="text-xs font-mono text-purple-300 break-all select-all whitespace-pre">
                        {step.codeSnippet}
                      </pre>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(step.codeSnippet!, `threads-step-${step.number}`)}
                        className="ml-3 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1.5 transition-all shrink-0 self-start"
                      >
                        {copiedKey === `threads-step-${step.number}` ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Important Alert Box */}
                  {step.importantNote && (
                    <div className="ml-10 p-3.5 rounded-xl bg-amber-950/20 border border-amber-600/30 flex items-start gap-2.5 text-xs text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">{step.importantNote}</p>
                    </div>
                  )}

                  {/* Visual Image Screenshot (Click to zoom) */}
                  {step.imageSrc && (
                    <div className="ml-10 space-y-2">
                      <div
                        onClick={() => setZoomImage({ src: step.imageSrc!, caption: step.imageCaption || step.title })}
                        className="relative group rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 cursor-pointer shadow-lg hover:border-purple-500/60 transition-all max-w-2xl"
                      >
                        <img
                          src={step.imageSrc}
                          alt={step.title}
                          className="w-full h-auto object-cover max-h-72 opacity-90 group-hover:opacity-100 transition-opacity"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-xs font-bold text-white backdrop-blur-[2px]">
                          <Maximize2 className="w-4 h-4" />
                          <span>Click to expand screenshot</span>
                        </div>
                      </div>
                      {step.imageCaption && (
                        <p className="text-[11px] text-slate-400 italic">
                          Reference: {step.imageCaption}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Quick Action Links */}
                  {step.links && (
                    <div className="ml-10 pt-2 flex flex-wrap gap-2">
                      {step.links.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-purple-300 hover:text-white transition-all shadow-sm"
                        >
                          <span>{link.label}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: FACEBOOK GUIDE */}
        {activePlatform === 'facebook' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Overview Card */}
            <div className="p-5 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-950/30 via-slate-900 to-indigo-950/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-blue-300 flex items-center gap-2">
                  <Facebook className="w-4 h-4 text-blue-400" />
                  Meta Facebook Graph API &amp; Page Reels Engine
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  Meta App ID: 1125007820131674
                </span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                VideoTimmer manages Facebook Pages, vertical Reels, and landscape video uploads using Meta Graph API with Page Access Tokens. Videos are automatically delivered to Meta via byte-range streaming, followed by automated #VAULT lead capture comments.
              </p>
            </div>

            {/* Stepper Flow */}
            <div className="space-y-4">
              {facebookSteps.map((step) => (
                <div
                  key={step.number}
                  className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-md space-y-3 hover:border-slate-700/80 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center text-xs font-bold shrink-0">
                        {step.number}
                      </div>
                      <h3 className="text-sm font-bold text-white tracking-tight">{step.title}</h3>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 ml-10 leading-relaxed">{step.description}</p>

                  {step.details && (
                    <ul className="ml-10 space-y-1.5 list-disc list-inside text-xs text-slate-400">
                      {step.details.map((detail, idx) => (
                        <li key={idx} className="leading-relaxed">
                          {detail}
                        </li>
                      ))}
                    </ul>
                  )}

                  {step.codeSnippet && (
                    <div className="ml-10 p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between font-mono text-xs text-blue-300">
                      <span className="truncate">{step.codeSnippet}</span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(step.codeSnippet!, `fb_step_${step.number}`)}
                        className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors shrink-0 ml-2"
                        title="Copy to clipboard"
                      >
                        {copiedKey === `fb_step_${step.number}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  )}

                  {step.importantNote && (
                    <div className="ml-10 p-3.5 rounded-xl bg-amber-950/20 border border-amber-600/30 flex items-start gap-2.5 text-xs text-amber-200">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="leading-relaxed">{step.importantNote}</p>
                    </div>
                  )}

                  {step.links && (
                    <div className="ml-10 pt-2 flex flex-wrap gap-2">
                      {step.links.map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-blue-300 hover:text-white transition-all shadow-sm"
                        >
                          <span>{link.label}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: IMPORTANT LINKS */}
        {activePlatform === 'links' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="p-4 rounded-2xl border border-blue-500/20 bg-blue-950/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-blue-200">
                  Direct Meta Developer Portal Quick Reference
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Meta App ID: 1125007820131674
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quickLinks.map((item, idx) => {
                const IconComponent = item.icon;
                return (
                  <a
                    key={idx}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-4 rounded-2xl border border-slate-800 bg-slate-900 hover:bg-slate-850 hover:border-slate-700 transition-all flex flex-col justify-between group shadow-sm"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                          {item.category}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
                      </div>
                      <h4 className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors flex items-center gap-2">
                        <IconComponent className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span>{item.title}</span>
                      </h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-blue-400 font-semibold">
                      <span>Open Link</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Screenshot Lightbox Modal */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-zoom-out animate-in fade-in"
        >
          <div className="relative max-w-5xl max-h-[90vh] bg-slate-900 rounded-2xl border border-slate-700 p-2 shadow-2xl flex flex-col">
            <button
              type="button"
              onClick={() => setZoomImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-800 border border-slate-600 text-white flex items-center justify-center shadow-lg hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="overflow-auto flex-1 rounded-xl">
              <img
                src={zoomImage.src}
                alt={zoomImage.caption}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            </div>
            <div className="p-3 text-center border-t border-slate-800 mt-2">
              <span className="text-xs font-medium text-slate-300">
                {zoomImage.caption}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

