let activeCampaign = null;
let activeSession = null;
let campaignBootstrapPromise = null;
let availableCampaigns = [];
let activeProfile = null;
const pendingMemberRoleChanges = new Map();

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

function setCampaignNameStatus(message = "") {
  const status = document.getElementById("campaign-name-status");
  if (status) {
    status.textContent = message;
  }
}

function setCampaignRenameStatus(message = "") {
  const status = document.getElementById("campaign-rename-status");
  if (status) {
    status.textContent = message;
  }
}

function setCampaignShareCodeStatus(message = "") {
  const status = document.getElementById("campaign-share-code-status");
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

function setCampaignUserSettingsStatus(message = "") {
  const status = document.getElementById("campaign-user-settings-status");
  if (status) {
    status.textContent = message;
  }
}

function setCampaignJoinCodeStatus(message = "") {
  const status = document.getElementById("campaign-join-code-status");
  if (status) {
    status.textContent = message;
  }
}

function getCurrentUserEmail() {
  return activeSession?.user?.email || "";
}

function canViewCampaignDebug() {
  return ["owner", "superuser"].includes(activeCampaign?.currentUserRole || "");
}

function canManageCampaignMembers() {
  return ["owner", "superuser"].includes(activeCampaign?.currentUserRole || "");
}

function canManageMemberRole(memberRole) {
  if (activeCampaign?.currentUserRole === "owner") return memberRole !== "owner";
  if (activeCampaign?.currentUserRole === "superuser") {
    return ["editor", "viewer"].includes(memberRole || "");
  }
  return false;
}

function getAssignableMemberRoles() {
  return activeCampaign?.currentUserRole === "owner"
    ? ["superuser", "editor", "viewer"]
    : ["editor", "viewer"];
}

function formatCampaignRole(role) {
  if (role === "owner") return "Keeper of the Codex";
  if (role === "superuser") return "Archivist";
  if (role === "editor") return "Scribe";
  if (role === "viewer") return "Initiate";
  if (role === "player") return "Pawn";
  return role || "";
}

function getCampaignRoleSortRank(role) {
  const ranks = {
    owner: 0,
    superuser: 1,
    editor: 2,
    viewer: 3
  };
  return ranks[role] ?? 99;
}

async function verifyCurrentPassword(currentPassword) {
  const email = getCurrentUserEmail();
  if (!email) throw new Error("Unable to verify current account.");

  const { data, error } = await campaignSupabase.auth.signInWithPassword({
    email,
    password: currentPassword
  });

  if (error) throw new Error("Current password is incorrect.");
  if (data?.session) activeSession = data.session;
}

function isValidCampaignUsername(username) {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/.test(String(username || "").trim());
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

function setCampaignDocumentTitle(campaign = null) {
  document.title = campaign?.name
    ? `${campaign.name} | Waymark Codex`
    : "Waymark Codex";
}

function clearActiveCampaignState() {
  activeCampaign = null;
  setCampaignDocumentTitle(null);
  window.db = null;
  if (typeof db !== "undefined") {
    db = null;
  }
  closeCodex?.();
  closePanel?.({ clearSelection: true });
}

function openCampaignSettingsMenu() {
  document.getElementById("campaign-settings-menu")?.classList.remove("hidden");
  document.getElementById("campaign-settings-button")?.setAttribute("aria-expanded", "true");
  document.getElementById("campaign-settings-debug-button")?.toggleAttribute("hidden", !canViewCampaignDebug());
  refreshCampaignMembers();
}

function closeCampaignSettingsMenu() {
  document.getElementById("campaign-settings-menu")?.classList.add("hidden");
  document.getElementById("campaign-debug-menu")?.classList.add("hidden");
  document.getElementById("campaign-manage-menu")?.classList.add("hidden");
  document.getElementById("campaign-members-menu")?.classList.add("hidden");
  document.getElementById("campaign-rename-menu")?.classList.add("hidden");
  document.getElementById("campaign-add-member-menu")?.classList.add("hidden");
  document.getElementById("campaign-user-settings-menu")?.classList.add("hidden");
  document.getElementById("campaign-settings-button")?.setAttribute("aria-expanded", "false");
}

function openCampaignDebugMenu() {
  if (!canViewCampaignDebug()) return;

  document.getElementById("campaign-settings-menu")?.classList.add("hidden");
  document.getElementById("campaign-debug-menu")?.classList.remove("hidden");
  document.getElementById("campaign-manage-menu")?.classList.add("hidden");
  document.getElementById("campaign-members-menu")?.classList.add("hidden");
  document.getElementById("campaign-rename-menu")?.classList.add("hidden");
  document.getElementById("campaign-add-member-menu")?.classList.add("hidden");
  document.getElementById("campaign-user-settings-menu")?.classList.add("hidden");
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
  pendingMemberRoleChanges.clear();
  updateSaveMemberRolesButton();

  if (!members.length) {
    list.innerHTML = `<div class="campaign-picker-empty">No members recorded.</div>`;
    return;
  }

  const sortedMembers = [...members].sort((left, right) => {
    const roleComparison = getCampaignRoleSortRank(left.role) - getCampaignRoleSortRank(right.role);
    if (roleComparison !== 0) return roleComparison;

    const leftName = left.username || "Unknown user";
    const rightName = right.username || "Unknown user";
    return leftName.localeCompare(rightName, undefined, { sensitivity: "base" });
  });

  list.innerHTML = sortedMembers.map(member => `
    <div class="campaign-settings-member-row">
      <span class="campaign-settings-member-name">${escapeCampaignHtml(member.username || "Unknown user")}</span>
      ${canManageMemberRole(member.role)
        ? `<select
            class="campaign-member-role-select"
            data-user-id="${escapeCampaignHtml(member.user_id)}"
            data-username="${escapeCampaignHtml(member.username || "Unknown user")}"
            data-original-role="${escapeCampaignHtml(member.role || "")}"
          >
            ${getAssignableMemberRoles().map(role => `
              <option value="${escapeCampaignHtml(role)}" ${member.role === role ? "selected" : ""}>${escapeCampaignHtml(formatCampaignRole(role))}</option>
            `).join("")}
          </select>`
        : `<span class="campaign-settings-member-role">${escapeCampaignHtml(formatCampaignRole(member.role))}</span>`}
      ${member.role === "owner"
        ? `<span class="campaign-settings-member-locked">—</span>`
        : canManageMemberRole(member.role)
          ? `<button
            class="campaign-remove-member-button"
            type="button"
            data-user-id="${escapeCampaignHtml(member.user_id)}"
            data-username="${escapeCampaignHtml(member.username || "Unknown user")}"
          >Remove</button>`
          : `<span class="campaign-settings-member-locked">—</span>`}
    </div>
  `).join("");
}

function updateSaveMemberRolesButton() {
  const button = document.getElementById("campaign-save-member-roles-button");
  if (!button) return;
  button.hidden = pendingMemberRoleChanges.size === 0;
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

function syncCampaignNameSettings() {
  const section = document.getElementById("campaign-name-section");
  const nameValue = document.getElementById("campaign-current-name-value");
  const isOwner = activeCampaign?.currentUserRole === "owner";

  section?.toggleAttribute("hidden", !isOwner);
  if (nameValue) nameValue.textContent = activeCampaign?.name || "Unknown";
  setCampaignNameStatus("");
}

function syncCampaignShareCodeSettings() {
  const section = document.getElementById("campaign-share-code-section");
  const codeBox = document.getElementById("campaign-share-code-box");
  const canGenerate = canManageCampaignMembers();

  section?.toggleAttribute("hidden", !canGenerate);
  if (codeBox) {
    codeBox.hidden = true;
    codeBox.textContent = "";
    delete codeBox.dataset.shareCode;
  }
  setCampaignShareCodeStatus("");
}

function openCampaignManageMenu() {
  document.getElementById("campaign-settings-menu")?.classList.add("hidden");
  document.getElementById("campaign-debug-menu")?.classList.add("hidden");
  document.getElementById("campaign-manage-menu")?.classList.remove("hidden");
  document.getElementById("campaign-members-menu")?.classList.add("hidden");
  document.getElementById("campaign-rename-menu")?.classList.add("hidden");
  document.getElementById("campaign-add-member-menu")?.classList.add("hidden");
  document.getElementById("campaign-user-settings-menu")?.classList.add("hidden");
  syncCampaignNameSettings();
}

function openCampaignMembersMenu() {
  document.getElementById("campaign-settings-menu")?.classList.add("hidden");
  document.getElementById("campaign-debug-menu")?.classList.add("hidden");
  document.getElementById("campaign-manage-menu")?.classList.add("hidden");
  document.getElementById("campaign-members-menu")?.classList.add("hidden");
  document.getElementById("campaign-members-menu")?.classList.remove("hidden");
  document.getElementById("campaign-rename-menu")?.classList.add("hidden");
  document.getElementById("campaign-add-member-menu")?.classList.add("hidden");
  document.getElementById("campaign-user-settings-menu")?.classList.add("hidden");
  setCampaignMemberStatus("");
  const canManageMembers = canManageCampaignMembers();
  document.getElementById("campaign-open-add-member-button")?.toggleAttribute("hidden", !canManageMembers);
  document.getElementById("campaign-role-help-button")?.toggleAttribute("hidden", !canManageMembers);
  document.getElementById("campaign-save-member-roles-button")?.setAttribute("hidden", "");
  syncCampaignShareCodeSettings();
  refreshCampaignMembers();
}

function openCampaignRenameMenu() {
  if (activeCampaign?.currentUserRole !== "owner") return;

  document.getElementById("campaign-settings-menu")?.classList.add("hidden");
  document.getElementById("campaign-debug-menu")?.classList.add("hidden");
  document.getElementById("campaign-manage-menu")?.classList.add("hidden");
  document.getElementById("campaign-members-menu")?.classList.add("hidden");
  document.getElementById("campaign-rename-menu")?.classList.remove("hidden");
  document.getElementById("campaign-add-member-menu")?.classList.add("hidden");
  document.getElementById("campaign-user-settings-menu")?.classList.add("hidden");
  document.getElementById("campaign-name-form")?.reset();

  const currentNameValue = document.getElementById("campaign-rename-current-name-value");
  const nameInput = document.getElementById("campaign-name-input");
  if (currentNameValue) currentNameValue.textContent = activeCampaign?.name || "Unknown";
  if (nameInput) nameInput.value = activeCampaign?.name || "";
  setCampaignRenameStatus("");
}

function openCampaignAddMemberMenu() {
  if (!canManageCampaignMembers()) return;

  document.getElementById("campaign-settings-menu")?.classList.add("hidden");
  document.getElementById("campaign-debug-menu")?.classList.add("hidden");
  document.getElementById("campaign-manage-menu")?.classList.add("hidden");
  document.getElementById("campaign-rename-menu")?.classList.add("hidden");
  document.getElementById("campaign-add-member-menu")?.classList.remove("hidden");
  document.getElementById("campaign-user-settings-menu")?.classList.add("hidden");
  const roleSelect = document.getElementById("campaign-add-member-role");
  if (roleSelect) {
    roleSelect.innerHTML = getAssignableMemberRoles().map(role =>
      `<option value="${escapeCampaignHtml(role)}">${escapeCampaignHtml(formatCampaignRole(role))}</option>`
    ).join("");
  }
  setCampaignAddMemberStatus("");
}

function openCampaignUserSettingsMenu({ fromPicker = false } = {}) {
  document.getElementById("campaign-settings-menu")?.classList.add("hidden");
  document.getElementById("campaign-debug-menu")?.classList.add("hidden");
  document.getElementById("campaign-manage-menu")?.classList.add("hidden");
  document.getElementById("campaign-rename-menu")?.classList.add("hidden");
  document.getElementById("campaign-add-member-menu")?.classList.add("hidden");
  document.getElementById("campaign-user-settings-menu")?.classList.remove("hidden");
  document.getElementById("campaign-user-settings-menu")?.classList.toggle("from-picker", fromPicker);
  document.getElementById("campaign-change-password-form")?.reset();
  document.getElementById("campaign-change-username-form")?.reset();
  showUserSettingsMainPanel();
  const usernameInput = document.getElementById("campaign-new-username");
  const usernameValue = document.getElementById("campaign-current-username-value");
  if (usernameInput) usernameInput.value = activeProfile?.username || "";
  if (usernameValue) usernameValue.textContent = activeProfile?.username || "Unknown";
  setCampaignUserSettingsStatus("");
  if (fromPicker) showCampaignSettings();
}

function showUserSettingsMainPanel() {
  document.getElementById("campaign-user-settings-main")?.removeAttribute("hidden");
  document.getElementById("campaign-change-username-section")?.setAttribute("hidden", "");
  document.getElementById("campaign-change-password-section")?.setAttribute("hidden", "");
  document.getElementById("campaign-user-settings-back-button")?.removeAttribute("hidden");
  setCampaignUserSettingsStatus("");
}

function showUserSettingsSection(section) {
  document.getElementById("campaign-user-settings-main")?.setAttribute("hidden", "");
  document.getElementById("campaign-change-username-section")?.toggleAttribute("hidden", section !== "username");
  document.getElementById("campaign-change-password-section")?.toggleAttribute("hidden", section !== "password");
  document.getElementById("campaign-user-settings-back-button")?.setAttribute("hidden", "");
  setCampaignUserSettingsStatus("");
}

function returnFromUserSettingsMenu() {
  const menu = document.getElementById("campaign-user-settings-menu");
  const fromPicker = menu?.classList.contains("from-picker");
  menu?.classList.add("hidden");

  if (fromPicker || !activeCampaign) {
    hideCampaignSettings();
    showCampaignPickerGate();
    return;
  }

  returnToMainSettingsMenu();
}

function returnToMainSettingsMenu() {
  document.getElementById("campaign-settings-menu")?.classList.remove("hidden");
  document.getElementById("campaign-debug-menu")?.classList.add("hidden");
  document.getElementById("campaign-manage-menu")?.classList.add("hidden");
  document.getElementById("campaign-members-menu")?.classList.add("hidden");
  document.getElementById("campaign-rename-menu")?.classList.add("hidden");
  document.getElementById("campaign-add-member-menu")?.classList.add("hidden");
  document.getElementById("campaign-user-settings-menu")?.classList.add("hidden");
}

function setCampaignAuthMode(mode) {
  const isSignup = mode === "signup";
  document.getElementById("campaign-auth-tab-signin")?.classList.toggle("active", !isSignup);
  document.getElementById("campaign-auth-tab-signup")?.classList.toggle("active", isSignup);
  document.getElementById("campaign-auth-signin-form").hidden = isSignup;
  document.getElementById("campaign-auth-signup-form").hidden = !isSignup;
  setCampaignAuthStatus("");
}

async function fetchAvailableCampaigns() {
  const { data, error } = await campaignSupabase
    .from("campaigns")
    .select("id, name, slug, owner_user_id, main_map_asset_id, main_map_width, main_map_height, map_mode, generated_map_config")
    .order("name", { ascending: true });

  if (error) throw error;

  const campaigns = data || [];
  const userId = activeSession?.user?.id;
  const campaignIds = campaigns.map(campaign => campaign.id);
  const ownerIds = [...new Set(campaigns.map(campaign => campaign.owner_user_id).filter(Boolean))];
  const mainMapAssetIds = [...new Set(campaigns.map(campaign => campaign.main_map_asset_id).filter(Boolean))];

  const [
    { data: memberships, error: membershipError },
    { data: owners, error: ownerError },
    { data: mainMapAssets, error: mainMapAssetError }
  ] = await Promise.all([
    campaignIds.length && userId
      ? campaignSupabase
          .from("campaign_members")
          .select("campaign_id, role")
          .eq("user_id", userId)
          .in("campaign_id", campaignIds)
      : Promise.resolve({ data: [], error: null }),
    ownerIds.length
      ? campaignSupabase
          .from("profiles")
          .select("id, username")
          .in("id", ownerIds)
      : Promise.resolve({ data: [], error: null }),
    mainMapAssetIds.length
      ? campaignSupabase
          .from("assets")
          .select("id, storage_bucket, storage_path, mime_type")
          .in("id", mainMapAssetIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (membershipError) throw membershipError;
  if (ownerError) throw ownerError;
  if (mainMapAssetError) throw mainMapAssetError;

  const signedMainMapEntries = await Promise.all((mainMapAssets || []).map(async asset => {
    const { data: signedData, error: signedError } = await campaignSupabase
      .storage
      .from(asset.storage_bucket)
      .createSignedUrl(asset.storage_path, 60 * 60 * 24);

    if (signedError) {
      console.warn("Campaign main map asset could not be signed:", asset.storage_path, signedError);
      return [asset.id, ""];
    }

    return [asset.id, signedData?.signedUrl || ""];
  }));

  const rolesByCampaignId = Object.fromEntries(
    (memberships || []).map(member => [member.campaign_id, member.role])
  );

  const ownersById = Object.fromEntries(
    (owners || []).map(owner => [owner.id, owner.username])
  );

  const mainMapUrlsByAssetId = Object.fromEntries(signedMainMapEntries);

  return campaigns.map(campaign => ({
    ...campaign,
    currentUserRole: rolesByCampaignId[campaign.id] || "",
    ownerUsername: ownersById[campaign.owner_user_id] || "Unknown",
    mainMapUrl: mainMapUrlsByAssetId[campaign.main_map_asset_id] || ""
  }));
}

async function fetchCurrentCampaignRole(campaignId) {
  const userId = activeSession?.user?.id;
  if (!campaignId || !userId) return null;

  const { data, error } = await campaignSupabase
    .from("campaign_members")
    .select("role")
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.role || null;
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
  activeProfile = data || null;
  return activeProfile;
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
    <div class="campaign-picker-row">
      <button
        class="campaign-picker-item"
        type="button"
        data-campaign-id="${campaign.id}"
      >
        <span class="campaign-picker-item-main">
          <strong>${escapeCampaignHtml(campaign.name)}</strong>
          <span>${escapeCampaignHtml(formatCampaignRole(campaign.currentUserRole))}</span>
        </span>
        <span class="campaign-picker-owner">
          Keeper of the Codex: ${escapeCampaignHtml(campaign.ownerUsername || "Unknown")}
        </span>
      </button>
      <button
        class="campaign-picker-leave-button"
        type="button"
        data-leave-campaign-id="${campaign.id}"
        data-campaign-name="${escapeCampaignHtml(campaign.name)}"
      >Leave</button>
    </div>
  `).join("");
}

async function showCampaignPickerForCurrentUser() {
  setCampaignDocumentTitle(null);
  availableCampaigns = await fetchAvailableCampaigns();
  const profile = await fetchCurrentProfile();
  renderCampaignPicker(profile, availableCampaigns);
  hideCampaignAuthGate();
  hideCampaignSettings();
  showCampaignPickerGate();
}

function openCampaignJoinCodeForm() {
  const menu = document.getElementById("campaign-join-code-menu");
  const input = document.getElementById("campaign-join-code-input");
  document.getElementById("campaign-join-code-form")?.reset();
  menu?.classList.remove("hidden");
  input?.focus();
  setCampaignJoinCodeStatus("");
}

function closeCampaignJoinCodeForm() {
  document.getElementById("campaign-join-code-menu")?.classList.add("hidden");
  document.getElementById("campaign-join-code-form")?.reset();
  setCampaignJoinCodeStatus("");
}

async function handleJoinCampaignByCode(event) {
  event.preventDefault();

  const input = document.getElementById("campaign-join-code-input");
  const code = input?.value.trim() || "";
  if (!code) return;

  setCampaignJoinCodeStatus("Joining campaign...");

  try {
    const { error } = await campaignSupabase.rpc("redeem_campaign_share_code", {
      raw_code: code
    });

    if (error) throw error;

    document.getElementById("campaign-join-code-form")?.reset();
    closeCampaignJoinCodeForm();
    await showCampaignPickerForCurrentUser();
  } catch (error) {
    console.error("Failed to join campaign by code:", error);
    setCampaignJoinCodeStatus(error.message || "Unable to join campaign.");
  }
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

    await showCampaignPickerForCurrentUser();
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
  clearActiveCampaignState();
  activeSession = null;
  availableCampaigns = [];
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

async function returnToCampaignList() {
  if (!activeSession) return;

  clearActiveCampaignState();
  await showCampaignPickerForCurrentUser();
}

async function handleChangeUsername(event) {
  event.preventDefault();

  const username = document.getElementById("campaign-new-username")?.value.trim() || "";
  const currentPassword = document.getElementById("campaign-username-current-password")?.value || "";
  const email = getCurrentUserEmail();

  if (!username || !currentPassword) return;

  if (!email) {
    setCampaignUserSettingsStatus("Unable to verify current account.");
    return;
  }

  if (!isValidCampaignUsername(username)) {
    setCampaignUserSettingsStatus("Username must be 3–32 characters and use letters, numbers, underscores, or hyphens.");
    return;
  }

  if (activeProfile?.username && username === activeProfile.username) {
    setCampaignUserSettingsStatus("That is already your username.");
    return;
  }

  setCampaignUserSettingsStatus("Changing username...");

  try {
    const { data: verifyData, error: verifyError } = await campaignSupabase.auth.signInWithPassword({
      email,
      password: currentPassword
    });
    if (verifyError) throw new Error("Current password is incorrect.");
    if (verifyData?.session) activeSession = verifyData.session;

    const { data, error } = await campaignSupabase.rpc("change_username", {
      new_username: username
    });

    if (error) throw error;

    activeProfile = data || {
      ...(activeProfile || {}),
      username
    };

    const { error: metadataError } = await campaignSupabase.auth.updateUser({
      data: {
        username: activeProfile.username,
        display_name: activeProfile.username
      }
    });

    if (metadataError) {
      console.warn("Username changed, but auth display metadata was not updated:", metadataError);
    }

    if (activeCampaign) {
      await fetchCurrentProfile();
      await refreshCampaignMembers();
      openCampaignUserSettingsMenu();
    } else {
      await showCampaignPickerForCurrentUser();
      showCampaignSettings();
      openCampaignUserSettingsMenu({ fromPicker: true });
    }
    setCampaignUserSettingsStatus("Username changed.");
  } catch (error) {
    console.error("Failed to change username:", error);
    setCampaignUserSettingsStatus(error.message || "Unable to change username.");
  }
}

async function handleChangePassword(event) {
  event.preventDefault();

  const currentPassword = document.getElementById("campaign-current-password")?.value || "";
  const password = document.getElementById("campaign-new-password")?.value || "";
  const confirmPassword = document.getElementById("campaign-confirm-password")?.value || "";
  const email = getCurrentUserEmail();

  if (!currentPassword || !password || !confirmPassword) return;

  if (!email) {
    setCampaignUserSettingsStatus("Unable to verify current account.");
    return;
  }

  if (password.length < 6) {
    setCampaignUserSettingsStatus("Password must be at least 6 characters.");
    return;
  }

  if (password !== confirmPassword) {
    setCampaignUserSettingsStatus("Passwords do not match.");
    return;
  }

  setCampaignUserSettingsStatus("Changing password...");

  try {
    const { data: verifyData, error: verifyError } = await campaignSupabase.auth.signInWithPassword({
      email,
      password: currentPassword
    });
    if (verifyError) throw new Error("Current password is incorrect.");
    if (verifyData?.session) activeSession = verifyData.session;

    const { error } = await campaignSupabase.auth.updateUser({ password });
    if (error) throw error;

    document.getElementById("campaign-change-password-form")?.reset();
    setCampaignUserSettingsStatus("Password changed.");
  } catch (error) {
    console.error("Failed to change password:", error);
    setCampaignUserSettingsStatus(error.message || "Unable to change password.");
  }
}

async function handleChangeCampaignName(event) {
  event.preventDefault();

  if (!activeCampaign) return;

  const name = document.getElementById("campaign-name-input")?.value.trim() || "";
  const currentPassword = document.getElementById("campaign-name-current-password")?.value || "";
  if (!name) {
    setCampaignRenameStatus("Campaign name is required.");
    return;
  }

  if (!currentPassword) return;

  if (activeCampaign.currentUserRole !== "owner") {
    setCampaignRenameStatus("Only the Keeper of the Codex can rename campaigns.");
    return;
  }

  if (name === activeCampaign.name) {
    setCampaignRenameStatus("That is already the campaign name.");
    return;
  }

  setCampaignRenameStatus("Saving campaign name...");

  try {
    await verifyCurrentPassword(currentPassword);

    const { data, error } = await campaignSupabase.rpc("change_campaign_name", {
      target_campaign_id: activeCampaign.id,
      new_name: name,
      rate_limit_hours: 24
    });

    if (error) throw error;

    activeCampaign.name = data || name;
    availableCampaigns = availableCampaigns.map(campaign =>
      campaign.id === activeCampaign.id
        ? { ...campaign, name: activeCampaign.name }
        : campaign
    );

    setCampaignDocumentTitle(activeCampaign);
    syncCampaignNameSettings();
    document.getElementById("campaign-name-form")?.reset();
    window.dispatchEvent(new CustomEvent("campaign-renamed", {
      detail: { campaign: activeCampaign }
    }));
    openCampaignManageMenu();
    setCampaignNameStatus("Campaign name saved.");
  } catch (error) {
    console.error("Failed to change campaign name:", error);
    setCampaignRenameStatus(error.message || "Unable to change campaign name.");
  }
}

async function handleGenerateCampaignShareCode() {
  if (!activeCampaign) return;

  if (!canManageCampaignMembers()) {
    setCampaignShareCodeStatus("Only the Keeper of the Codex and Archivists can generate share codes.");
    return;
  }

  setCampaignShareCodeStatus("Generating share code...");

  try {
    const { data, error } = await campaignSupabase.rpc("generate_campaign_share_code", {
      target_campaign_id: activeCampaign.id,
      role_to_grant: document.getElementById("campaign-share-code-role")?.value || "editor",
      max_uses: 1,
      expires_in_hours: 168
    });

    if (error) throw error;

    const code = data || "";
    const codeBox = document.getElementById("campaign-share-code-box");
    if (codeBox) {
      codeBox.textContent = code;
      codeBox.dataset.shareCode = code;
      codeBox.hidden = false;
    }
    setCampaignShareCodeStatus("Click the code to copy it.");
  } catch (error) {
    console.error("Failed to generate campaign share code:", error);
    setCampaignShareCodeStatus(error.message || "Unable to generate share code.");
  }
}

async function handleCopyCampaignShareCode() {
  const codeBox = document.getElementById("campaign-share-code-box");
  const code = codeBox?.dataset.shareCode || "";
  if (!code) return;

  try {
    await navigator.clipboard.writeText(code);
    setCampaignShareCodeStatus("Share code copied.");
  } catch (error) {
    console.error("Failed to copy campaign share code:", error);
    setCampaignShareCodeStatus("Unable to copy automatically.");
  }
}

async function handleAddCampaignMember(event) {
  event.preventDefault();

  if (!activeCampaign) return;

  const username = document.getElementById("campaign-add-member-username")?.value.trim().toLowerCase();
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

async function handleRemoveCampaignMember(event) {
  const button = event.target.closest(".campaign-remove-member-button");
  if (!button || !activeCampaign) return;

  const username = button.dataset.username || "this member";
  const confirmed = await showCampaignConfirm(`Remove ${username} from this campaign?`, {
    title: "Remove Member?",
    confirmLabel: "Remove",
    tone: "danger"
  });
  if (!confirmed) return;

  button.disabled = true;
  setCampaignMemberStatus("Removing member...");

  try {
    const { error } = await campaignSupabase.rpc("remove_campaign_member", {
      target_campaign_id: activeCampaign.id,
      target_user_id: button.dataset.userId
    });

    if (error) throw error;

    setCampaignMemberStatus("Member removed.");
    await refreshCampaignMembers();
  } catch (error) {
    console.error("Failed to remove campaign member:", error);
    setCampaignMemberStatus(error.message || "Unable to remove member.");
    button.disabled = false;
  }
}

async function handleChangeCampaignMemberRole(event) {
  const select = event.target.closest(".campaign-member-role-select");
  if (!select || !activeCampaign) return;

  const userId = select.dataset.userId;
  const role = select.value;
  if (!userId || !role) return;

  if (role === select.dataset.originalRole) {
    pendingMemberRoleChanges.delete(userId);
  } else {
    pendingMemberRoleChanges.set(userId, role);
  }

  updateSaveMemberRolesButton();
  setCampaignMemberStatus(pendingMemberRoleChanges.size ? "Unsaved member changes." : "");
}

async function handleSaveCampaignMemberRoles() {
  if (!activeCampaign || !pendingMemberRoleChanges.size) return;

  const changes = [...pendingMemberRoleChanges.entries()];
  document.getElementById("campaign-save-member-roles-button")?.setAttribute("disabled", "");
  setCampaignMemberStatus("Saving member changes...");

  try {
    for (const [userId, role] of changes) {
      const { error } = await campaignSupabase.rpc("set_campaign_member_role", {
        target_campaign_id: activeCampaign.id,
        target_user_id: userId,
        target_role: role
      });

      if (error) throw error;
    }

    pendingMemberRoleChanges.clear();
    setCampaignMemberStatus("Member changes saved.");
    await refreshCampaignMembers();
  } catch (error) {
    console.error("Failed to save member roles:", error);
    setCampaignMemberStatus(error.message || "Unable to save member changes.");
    await refreshCampaignMembers();
  } finally {
    document.getElementById("campaign-save-member-roles-button")?.removeAttribute("disabled");
  }
}

async function leaveCampaign(campaignId, campaignName = "this campaign") {
  const role = await fetchCurrentCampaignRole(campaignId);
  if (role === "owner") {
    const message = "The Keeper of the Codex can not leave their own campaign.";
    setCampaignMemberStatus(message);
    window.codexAlert?.(message, { title: "Keeper Required" }) || window.alert(message);
    return;
  }

  const confirmed = await showCampaignConfirm(`Leave ${campaignName}? You will lose access unless the Keeper of the Codex adds you back.`, {
    title: "Leave Campaign?",
    confirmLabel: "Leave",
    tone: "danger"
  });
  if (!confirmed) return;

  try {
    const { error } = await campaignSupabase.rpc("leave_campaign", {
      target_campaign_id: campaignId
    });

    if (error) throw error;

    if (activeCampaign?.id === campaignId) {
      clearActiveCampaignState();
    }

    await showCampaignPickerForCurrentUser();
  } catch (error) {
    console.error("Failed to leave campaign:", error);
    setCampaignMemberStatus(error.message || "Unable to leave campaign.");
  }
}

async function handleLeaveActiveCampaign() {
  if (!activeCampaign) return;
  await leaveCampaign(activeCampaign.id, activeCampaign.name);
}

function showCampaignConfirm(message, options = {}) {
  return window.codexConfirm
    ? window.codexConfirm(message, options)
    : Promise.resolve(window.confirm?.(message) === true);
}

function handleCampaignPickerClick(event) {
  const leaveButton = event.target.closest("[data-leave-campaign-id]");
  if (leaveButton) {
    leaveCampaign(
      leaveButton.dataset.leaveCampaignId,
      leaveButton.dataset.campaignName || "this campaign"
    );
    return;
  }

  const button = event.target.closest("[data-campaign-id]");
  if (!button) return;

  const campaign = availableCampaigns.find(row => row.id === button.dataset.campaignId);
  if (!campaign) return;

  activeCampaign = campaign;
  setCampaignDocumentTitle(campaign);
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
  document.getElementById("campaign-settings-signout-button")
    ?.addEventListener("click", handleCampaignSignOut);
  document.getElementById("campaign-signout-button")
    ?.addEventListener("click", handleCampaignSignOut);
  document.getElementById("campaign-settings-close-button")
    ?.addEventListener("click", closeCampaignSettingsMenu);
  document.getElementById("campaign-settings-campaign-button")
    ?.addEventListener("click", openCampaignManageMenu);
  document.getElementById("campaign-settings-members-button")
    ?.addEventListener("click", openCampaignMembersMenu);
  document.getElementById("campaign-settings-user-button")
    ?.addEventListener("click", () => openCampaignUserSettingsMenu());
  document.getElementById("campaign-settings-picker-button")
    ?.addEventListener("click", returnToCampaignList);
  document.getElementById("campaign-picker-user-settings-button")
    ?.addEventListener("click", () => openCampaignUserSettingsMenu({ fromPicker: true }));
  document.getElementById("campaign-open-join-code-button")
    ?.addEventListener("click", openCampaignJoinCodeForm);
  document.getElementById("campaign-join-code-back-button")
    ?.addEventListener("click", closeCampaignJoinCodeForm);
  document.getElementById("campaign-join-code-form")
    ?.addEventListener("submit", handleJoinCampaignByCode);
  document.getElementById("campaign-user-settings-back-button")
    ?.addEventListener("click", returnFromUserSettingsMenu);
  document.getElementById("campaign-open-change-username-button")
    ?.addEventListener("click", () => showUserSettingsSection("username"));
  document.getElementById("campaign-open-change-password-button")
    ?.addEventListener("click", () => showUserSettingsSection("password"));
  document.getElementById("campaign-change-username-back-button")
    ?.addEventListener("click", showUserSettingsMainPanel);
  document.getElementById("campaign-change-password-back-button")
    ?.addEventListener("click", showUserSettingsMainPanel);
  document.getElementById("campaign-change-username-form")
    ?.addEventListener("submit", handleChangeUsername);
  document.getElementById("campaign-change-password-form")
    ?.addEventListener("submit", handleChangePassword);
  document.getElementById("campaign-name-form")
    ?.addEventListener("submit", handleChangeCampaignName);
  document.getElementById("campaign-open-rename-button")
    ?.addEventListener("click", openCampaignRenameMenu);
  document.getElementById("campaign-rename-back-button")
    ?.addEventListener("click", openCampaignManageMenu);
  document.getElementById("campaign-generate-share-code-button")
    ?.addEventListener("click", handleGenerateCampaignShareCode);
  document.getElementById("campaign-share-code-box")
    ?.addEventListener("click", handleCopyCampaignShareCode);
  document.getElementById("campaign-settings-leave-button")
    ?.addEventListener("click", handleLeaveActiveCampaign);
  document.getElementById("campaign-open-add-member-button")
    ?.addEventListener("click", openCampaignAddMemberMenu);
  document.getElementById("campaign-manage-back-button")
    ?.addEventListener("click", returnToMainSettingsMenu);
  document.getElementById("campaign-add-member-back-button")
    ?.addEventListener("click", openCampaignMembersMenu);
  document.getElementById("campaign-members-back-button")
    ?.addEventListener("click", openCampaignManageMenu);
  document.getElementById("campaign-save-member-roles-button")
    ?.addEventListener("click", handleSaveCampaignMemberRoles);
  document.getElementById("campaign-add-member-form")
    ?.addEventListener("submit", handleAddCampaignMember);
  document.getElementById("campaign-settings-member-list")
    ?.addEventListener("click", handleRemoveCampaignMember);
  document.getElementById("campaign-settings-member-list")
    ?.addEventListener("change", handleChangeCampaignMemberRole);
  document.getElementById("campaign-settings-button")
    ?.addEventListener("click", toggleCampaignSettingsMenu);
  document.getElementById("campaign-settings-debug-button")
    ?.addEventListener("click", openCampaignDebugMenu);
  document.getElementById("campaign-debug-back-button")
    ?.addEventListener("click", returnToMainSettingsMenu);
  document.getElementById("campaign-settings-guides-button")
    ?.addEventListener("click", () => {
      toggleCodexDebugGuides?.();
    });
  document.getElementById("campaign-settings-audit-button")
    ?.addEventListener("click", toggleCodexAuditLog);
  document.getElementById("campaign-picker-list")
    ?.addEventListener("click", handleCampaignPickerClick);
});

window.getActiveCampaign = () => activeCampaign;
window.getActiveCampaignSession = () => activeSession;
window.getActiveCampaignProfile = () => activeProfile;
window.bootstrapCampaignSession = bootstrapCampaignSession;
window.showCampaignSettings = showCampaignSettings;
window.openCampaignSettingsMenu = openCampaignSettingsMenu;
