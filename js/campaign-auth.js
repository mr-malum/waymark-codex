let activeCampaign = null;
let activeSession = null;
let campaignBootstrapPromise = null;
let availableCampaigns = [];

function getCampaignAuthGate() {
  return document.getElementById("campaign-auth-gate");
}

function getCampaignPickerGate() {
  return document.getElementById("campaign-picker-gate");
}

function getCampaignSettingsShell() {
  return document.getElementById("campaign-settings-shell");
}

function setCampaignAuthStatus(message = "") {
  const status = document.getElementById("campaign-auth-status");
  if (status) {
    status.textContent = message;
  }
}

function setCampaignAuthBusy(isBusy) {
  const submit = document.getElementById("campaign-auth-submit");
  if (submit) {
    submit.disabled = isBusy;
  }
}

function showCampaignAuthGate() {
  getCampaignAuthGate()?.classList.remove("hidden");
}

function hideCampaignAuthGate() {
  getCampaignAuthGate()?.classList.add("hidden");
}

function setCampaignMemberStatus(message = "") {
  const status = document.getElementById("campaign-member-status");
  if (status) {
    status.textContent = message;
  }
}

function setCampaignAddMemberStatus(message = "") {
  const status = document.getElementById("campaign-add-member-status");
  if (status) {
    status.textContent = message;
  }
}

function escapeCampaignHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showCampaignPickerGate() {
  getCampaignPickerGate()?.classList.remove("hidden");
}

function hideCampaignPickerGate() {
  getCampaignPickerGate()?.classList.add("hidden");
}

function showCampaignSettings() {
  getCampaignSettingsShell()?.classList.remove("hidden");
}

function hideCampaignSettings() {
  getCampaignSettingsShell()?.classList.add("hidden");
  closeCampaignSettingsMenu();
}

function openCampaignSettingsMenu() {
  document.getElementById("campaign-settings-menu")?.classList.remove("hidden");
  document.getElementById("campaign-settings-button")?.setAttribute("aria-expanded", "true");
  refreshCampaignMembers();
}

function closeCampaignSettingsMenu() {
  document.getElementById("campaign-settings-menu")?.classList.add("hidden");
  document.getElementById("campaign-manage-menu")?.classList.add("hidden");
  document.getElementById("campaign-add-member-menu")?.classList.add("hidden");
  document.getElementById("campaign-settings-button")?.setAttribute("aria-expanded", "false");
}

function toggleCampaignSettingsMenu() {
  const menu = document.getElementById("campaign-settings-menu");
  if (!menu) return;
  if (menu.classList.contains("hidden")) {
    openCampaignSettingsMenu();
  } else {
    closeCampaignSettingsMenu();
  }
}

async function fetchCampaignMembers(campaignId) {
  const { data: memberships, error } = await campaignSupabase
    .from("campaign_members")
    .select("user_id, role, created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const userIds = (memberships || []).map(member => member.user_id);
  if (!userIds.length) return [];

  const { data: profiles, error: profileError } = await campaignSupabase
    .from("profiles")
    .select("id, username")
    .in("id", userIds);

  if (profileError) throw profileError;

  const profilesById = Object.fromEntries((profiles || []).map(profile => [profile.id, profile]));

  return (memberships || []).map(member => ({
    ...member,
    username: profilesById[member.user_id]?.username || ""
  }));
}

function renderCampaignMembers(members) {
  const list = document.getElementById("campaign-settings-member-list");
  if (!list) return;

  if (!members.length) {
    list.innerHTML = `<div class="campaign-picker-empty">No members recorded.</div>`;
    return;
  }

  list.innerHTML = members.map(member => `
    <div class="campaign-settings-member-row">
      <span>${escapeCampaignHtml(member.username || "Unknown user")}</span>
      <span>${escapeCampaignHtml(member.role === "owner" ? "Owner" : member.role || "")}</span>
    </div>
  `).join("");
}

async function refreshCampaignMembers() {
  if (!activeCampaign) return;

  try {
    const members = await fetchCampaignMembers(activeCampaign.id);
    renderCampaignMembers(members);
  } catch (error) {
    console.error("Failed to load campaign members:", error);
    setCampaignMemberStatus("Unable to load members.");
  }
}

function openCampaignManageMenu() {
  document.getElementById("campaign-settings-menu")?.classList.add("hidden");
  document.getElementById("campaign-manage-menu")?.classList.remove("hidden");
  document.getElementById("campaign-add-member-menu")?.classList.add("hidden");
  setCampaignMemberStatus("");
  refreshCampaignMembers();
}

function openCampaignAddMemberMenu() {
  document.getElementById("campaign-settings-menu")?.classList.add("hidden");
  document.getElementById("campaign-manage-menu")?.classList.add("hidden");
  document.getElementById("campaign-add-member-menu")?.classList.remove("hidden");
  setCampaignAddMemberStatus("");
}

function returnToMainSettingsMenu() {
  document.getElementById("campaign-settings-menu")?.classList.remove("hidden");
  document.getElementById("campaign-manage-menu")?.classList.add("hidden");
  document.getElementById("campaign-add-member-menu")?.classList.add("hidden");
}

function setCampaignAuthMode(mode) {
  const isSignup = mode === "signup";
  document.getElementById("campaign-auth-tab-signin")?.classList.toggle("active", !isSignup);
  document.getElementById("campaign-auth-tab-signup")?.classList.toggle("active", isSignup);
  document.getElementById("campaign-auth-signin-form").hidden = isSignup;
  document.getElementById("campaign-auth-signup-form").hidden = !isSignup;
  document.getElementById("campaign-auth-title").textContent = isSignup ? "Create account" : "Sign in";
  document.getElementById("campaign-auth-copy").textContent = isSignup
    ? "Choose a username and create your account."
    : "Enter your account details to open your campaigns.";
  setCampaignAuthStatus("");
}

async function fetchAvailableCampaigns() {
  const { data, error } = await campaignSupabase
    .from("campaigns")
    .select("id, name, slug")
    .order("name", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function fetchCurrentProfile() {
  const userId = activeSession?.user?.id;
  if (!userId) return null;

  const { data, error } = await campaignSupabase
    .from("profiles")
    .select("id, username")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

function renderCampaignPicker(profile, campaigns) {
  const welcome = document.getElementById("campaign-picker-welcome");
  const list = document.getElementById("campaign-picker-list");

  if (welcome) {
    welcome.textContent = profile?.username
      ? `Signed in as ${profile.username}.`
      : "Signed in.";
  }

  if (!list) return;

  if (!campaigns.length) {
    list.innerHTML = `
      <div class="campaign-picker-empty">
        No campaigns are available for this account yet.
      </div>
    `;
    return;
  }

  list.innerHTML = campaigns.map(campaign => `
    <button
      class="campaign-picker-item"
      type="button"
      data-campaign-id="${campaign.id}"
    >
      <strong>${escapeCampaignHtml(campaign.name)}</strong>
      <span>${escapeCampaignHtml(campaign.slug)}</span>
    </button>
  `).join("");
}

async function bootstrapCampaignSession() {
  if (campaignBootstrapPromise) return campaignBootstrapPromise;

  campaignBootstrapPromise = (async () => {
    const { data, error } = await campaignSupabase.auth.getSession();
    if (error) throw error;

    activeSession = data.session || null;

    if (!activeSession) {
      showCampaignAuthGate();
      return null;
    }

    if (activeCampaign) {
      return activeCampaign;
    }

    availableCampaigns = await fetchAvailableCampaigns();
    const profile = await fetchCurrentProfile();

    hideCampaignAuthGate();
    hideCampaignSettings();
    renderCampaignPicker(profile, availableCampaigns);
    showCampaignPickerGate();
    return null;
  })();

  try {
    return await campaignBootstrapPromise;
  } finally {
    campaignBootstrapPromise = null;
  }
}

async function handleCampaignAuthSubmit(event) {
  event.preventDefault();

  const identifier = document.getElementById("campaign-auth-identifier")?.value.trim();
  const password = document.getElementById("campaign-auth-password")?.value;

  if (!identifier || !password) return;

  setCampaignAuthBusy(true);
  setCampaignAuthStatus("Signing in...");

  try {
    let email = identifier;

    if (!identifier.includes("@")) {
      const { data, error: resolveError } = await campaignSupabase.rpc("resolve_login_email_by_username", {
        target_username: identifier
      });

      if (resolveError) throw resolveError;
      email = data || "";
    }

    if (!email) {
      throw new Error("Invalid login credentials");
    }

    const { error } = await campaignSupabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    const campaign = await bootstrapCampaignSession();
    if (!campaign) setCampaignAuthStatus("");
  } catch (error) {
    console.error("Campaign sign-in failed:", error);
    setCampaignAuthStatus(error.message || "Unable to sign in.");
  } finally {
    setCampaignAuthBusy(false);
  }
}

async function handleCampaignSignupSubmit(event) {
  event.preventDefault();

  const username = document.getElementById("campaign-signup-username")?.value.trim();
  const email = document.getElementById("campaign-signup-email")?.value.trim();
  const password = document.getElementById("campaign-signup-password")?.value;

  if (!username || !email || !password) return;

  setCampaignAuthBusy(true);
  setCampaignAuthStatus("Creating account...");

  try {
    const { data, error } = await campaignSupabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: username
        }
      }
    });

    if (error) throw error;

    if (data.session) {
      await bootstrapCampaignSession();
      setCampaignAuthStatus("");
      return;
    }

    setCampaignAuthMode("signin");
    setCampaignAuthStatus("Account created. Check your email to confirm it, then return here to sign in.");
  } catch (error) {
    console.error("Campaign sign-up failed:", error);
    setCampaignAuthStatus(error.message || "Unable to create account.");
  } finally {
    setCampaignAuthBusy(false);
  }
}

async function handleCampaignSignOut() {
  await campaignSupabase.auth.signOut();
  activeCampaign = null;
  activeSession = null;
  availableCampaigns = [];
  window.db = null;
  if (typeof db !== "undefined") {
    db = null;
  }
  hideCampaignPickerGate();
  showCampaignAuthGate();
  hideCampaignSettings();
  setCampaignAuthMode("signin");
  const signinForm = document.getElementById("campaign-auth-signin-form");
  const signupForm = document.getElementById("campaign-auth-signup-form");
  signinForm?.reset();
  signupForm?.reset();
  setCampaignAuthStatus("");
}

async function handleAddCampaignMember(event) {
  event.preventDefault();

  if (!activeCampaign) return;

  const username = document.getElementById("campaign-add-member-username")?.value.trim();
  const role = document.getElementById("campaign-add-member-role")?.value;

  if (!username || !role) return;

  setCampaignAddMemberStatus("Adding member...");

  try {
    const { error } = await campaignSupabase.rpc("add_campaign_member_by_username", {
      target_campaign_id: activeCampaign.id,
      target_username: username,
      target_role: role
    });

    if (error) throw error;

    document.getElementById("campaign-add-member-form")?.reset();
    setCampaignAddMemberStatus("Member added.");
    await refreshCampaignMembers();
    openCampaignManageMenu();
  } catch (error) {
    console.error("Failed to add campaign member:", error);
    setCampaignAddMemberStatus(error.message || "Unable to add member.");
  }
}

function handleCampaignPickerClick(event) {
  const button = event.target.closest("[data-campaign-id]");
  if (!button) return;

  const campaign = availableCampaigns.find(row => row.id === button.dataset.campaignId);
  if (!campaign) return;

  activeCampaign = campaign;
  hideCampaignPickerGate();
  showCampaignSettings();

  window.dispatchEvent(new CustomEvent("campaign-authenticated", {
    detail: { campaign }
  }));
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("campaign-auth-signin-form")
    ?.addEventListener("submit", handleCampaignAuthSubmit);
  document.getElementById("campaign-auth-signup-form")
    ?.addEventListener("submit", handleCampaignSignupSubmit);
  document.getElementById("campaign-auth-tab-signin")
    ?.addEventListener("click", () => setCampaignAuthMode("signin"));
  document.getElementById("campaign-auth-tab-signup")
    ?.addEventListener("click", () => setCampaignAuthMode("signup"));
  document.getElementById("campaign-signout-button")
    ?.addEventListener("click", handleCampaignSignOut);
  document.getElementById("campaign-settings-signout-button")
    ?.addEventListener("click", handleCampaignSignOut);
  document.getElementById("campaign-settings-close-button")
    ?.addEventListener("click", closeCampaignSettingsMenu);
  document.getElementById("campaign-settings-campaign-button")
    ?.addEventListener("click", openCampaignManageMenu);
  document.getElementById("campaign-open-add-member-button")
    ?.addEventListener("click", openCampaignAddMemberMenu);
  document.getElementById("campaign-manage-back-button")
    ?.addEventListener("click", returnToMainSettingsMenu);
  document.getElementById("campaign-add-member-back-button")
    ?.addEventListener("click", openCampaignManageMenu);
  document.getElementById("campaign-add-member-form")
    ?.addEventListener("submit", handleAddCampaignMember);
  document.getElementById("campaign-settings-button")
    ?.addEventListener("click", toggleCampaignSettingsMenu);
  document.getElementById("campaign-settings-guides-button")
    ?.addEventListener("click", () => {
      toggleCodexDebugGuides?.();
      closeCampaignSettingsMenu();
    });
  document.getElementById("campaign-picker-list")
    ?.addEventListener("click", handleCampaignPickerClick);
});

window.getActiveCampaign = () => activeCampaign;
window.bootstrapCampaignSession = bootstrapCampaignSession;
