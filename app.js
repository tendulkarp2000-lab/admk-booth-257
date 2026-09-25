// ADMK Election Management System - Main Logic Engine
// v3.0 - Bugs Fixed + Family Visit Tracker Feature Added
(function () {
    const ACTIVE_KEY_VOTERS = 'admk_booth_257_voters_master';
    const ACTIVE_KEY_FAMILIES = 'admk_booth_257_families_master';
    const ACTIVE_KEY_OORUS = 'admk_booth_257_oorus_master';

    const LEGACY_KEYS_FAMILIES = [
        'admk_booth_257_families_v6', 'admk_booth_257_families_v5',
        'admk_booth_257_families_v4', 'admk_booth_257_families_v3',
        'admk_booth_257_families_v2', 'admk_booth_257_families_v1',
        'admk_booth_257_families'
    ];
    const LEGACY_KEYS_VOTERS = [
        'admk_booth_257_voters_v6', 'admk_booth_257_voters_v5',
        'admk_booth_257_voters_v4', 'admk_booth_257_voters_v3',
        'admk_booth_257_voters_v2', 'admk_booth_257_voters_v1',
        'admk_booth_257_voters'
    ];

    // Visit status constants
    const VISIT_STATUS = {
        NOT_VISITED: 'not_visited',
        VISITED: 'visited',
        FOLLOW_UP: 'follow_up'
    };

    // Support status constants
    const SUPPORT_STATUS = {
        UNKNOWN: 'unknown',
        SUPPORTER: 'supporter',
        OPPOSITION: 'opposition',
        UNDECIDED: 'undecided',
        TO_CONVINCE: 'to_convince'
    };

    function loadStateWithMigration() {
        let masterFamilies = localStorage.getItem(ACTIVE_KEY_FAMILIES);
        let masterVoters = localStorage.getItem(ACTIVE_KEY_VOTERS);
        let masterOorus = localStorage.getItem(ACTIVE_KEY_OORUS);

        let families = masterFamilies ? JSON.parse(masterFamilies) : null;
        let voters = masterVoters ? JSON.parse(masterVoters) : null;
        let oorus = masterOorus ? JSON.parse(masterOorus) : null;

        if (!families || families.length === 0) {
            for (const key of LEGACY_KEYS_FAMILIES) {
                const item = localStorage.getItem(key);
                if (item) {
                    const parsed = JSON.parse(item);
                    if (parsed && parsed.length > 0) { families = parsed; break; }
                }
            }
        }

        if (!voters || voters.length === 0) {
            for (const key of LEGACY_KEYS_VOTERS) {
                const item = localStorage.getItem(key);
                if (item) {
                    const parsed = JSON.parse(item);
                    if (parsed && parsed.length > 0) { voters = parsed; break; }
                }
            }
        }

        families = families || [];
        // BUG 3 FIX: Explicitly always use window.INITIAL_VOTERS when no saved data
        voters = (voters && voters.length > 0) ? voters : (window.INITIAL_VOTERS ? JSON.parse(JSON.stringify(window.INITIAL_VOTERS)) : []);
        oorus = (oorus && oorus.length > 0) ? oorus : (window.INITIAL_OORUS || []);

        // Migrate existing families to have visitStatus & supportStatus if missing
        families = families.map(f => ({
            visitStatus: VISIT_STATUS.NOT_VISITED,
            supportStatus: SUPPORT_STATUS.UNKNOWN,
            visitNotes: '',
            visitedAt: null,
            ...f
        }));

        localStorage.setItem(ACTIVE_KEY_FAMILIES, JSON.stringify(families));
        localStorage.setItem(ACTIVE_KEY_VOTERS, JSON.stringify(voters));
        localStorage.setItem(ACTIVE_KEY_OORUS, JSON.stringify(oorus));

        return { voters, families, oorus };
    }

    function saveState(state) {
        localStorage.setItem(ACTIVE_KEY_VOTERS, JSON.stringify(state.voters));
        localStorage.setItem(ACTIVE_KEY_FAMILIES, JSON.stringify(state.families));
        localStorage.setItem(ACTIVE_KEY_OORUS, JSON.stringify(state.oorus));
    }

    // BUG 2 FIX: Generate unique family ID using max existing ID (not array length)
    function generateFamilyId(families) {
        const maxId = families.reduce((max, f) => {
            const num = parseInt((f.id || '').replace('FAM_', '')) || 0;
            return num > max ? num : max;
        }, 0);
        return 'FAM_' + String(maxId + 1).padStart(4, '0');
    }

    window.admkApp = function () {
        const init = loadStateWithMigration();

        return {
            currentTab: 'dashboard',
            voters: init.voters,
            families: init.families,
            oorus: init.oorus,

            // Filter States for Voter Table
            voterSearch: '',
            selectedOoruFilter: '',
            selectedStatusFilter: '',
            selectedGenderFilter: '',
            selectedAgeFilter: '',
            voterPage: 1,
            pageSize: 25,

            // Filter States for Family View
            familySearch: '',
            familyOoruFilter: '',
            familyVisitFilter: '',

            // Ooru Management State
            newOoruInput: '',
            editingOoruOldName: null,
            editingOoruNewName: '',

            // Manual Mapping Modal State
            showManualModal: false,
            manualSearchQuery: '',
            manualForm: {
                ooru: '',
                houseNo: '',
                caste: '',
                mobile: '',
                headSlNo: null,
                selectedSlNos: []
            },

            // Add Member Modal State
            showAddMemberModal: false,
            targetFamilyForAddMember: null,
            addMemberSearchQuery: '',

            // Edit Family Modal State
            showEditFamilyModal: false,
            editingFamily: null,

            // Visit Notes Modal State
            showNotesModal: false,
            notesTargetFamilyId: null,
            notesText: '',

            // Print View State
            selectedPrintFamilyId: null,

            // Toast Notification
            toastMessage: '',
            showToast: false,

            init() {
                console.log(`ADMK App v3.0 Loaded. Families: ${this.families.length}`);
                this.persist();
            },

            persist() {
                saveState({ voters: this.voters, families: this.families, oorus: this.oorus });
            },

            notify(msg) {
                this.toastMessage = msg;
                this.showToast = true;
                setTimeout(() => { this.showToast = false; }, 3500);
            },

            // ===== COMPUTED STATS =====
            get totalVotersCount() { return this.voters.length; },
            get mappedVotersCount() { return this.voters.filter(v => v.familyId).length; },
            get unmappedVotersCount() { return this.voters.filter(v => !v.familyId).length; },
            get totalFamiliesCount() { return this.families.length; },
            get maleVotersCount() { return this.voters.filter(v => v.gender === 'ஆண்').length; },
            get femaleVotersCount() { return this.voters.filter(v => v.gender === 'பெண்').length; },

            // AGE WISE CLASSIFICATION (Fixed: consistent ranges, no boundary overlap)
            get age18_25Count() { return this.voters.filter(v => v.age >= 18 && v.age < 26).length; },
            get age26_35Count() { return this.voters.filter(v => v.age >= 26 && v.age < 36).length; },
            get age36_50Count() { return this.voters.filter(v => v.age >= 36 && v.age < 51).length; },
            get age51_70Count() { return this.voters.filter(v => v.age >= 51 && v.age < 71).length; },
            get age71_90Count() { return this.voters.filter(v => v.age >= 71 && v.age < 91).length; },
            get age90PlusCount() { return this.voters.filter(v => v.age >= 91).length; },

            // ===== VISIT TRACKER STATS =====
            get visitedFamiliesCount() { return this.families.filter(f => f.visitStatus === 'visited').length; },
            get notVisitedFamiliesCount() { return this.families.filter(f => f.visitStatus === 'not_visited').length; },
            get followUpFamiliesCount() { return this.families.filter(f => f.visitStatus === 'follow_up').length; },
            get visitProgressPercent() {
                if (!this.families.length) return 0;
                return Math.round((this.visitedFamiliesCount / this.families.length) * 100);
            },

            // SUPPORT STATUS STATS
            get supporterCount() { return this.families.filter(f => f.supportStatus === 'supporter').length; },
            get oppositionCount() { return this.families.filter(f => f.supportStatus === 'opposition').length; },
            get undecidedCount() { return this.families.filter(f => f.supportStatus === 'undecided').length; },
            get toConvinceCount() { return this.families.filter(f => f.supportStatus === 'to_convince').length; },

            // Visit status UI helpers
            getVisitStatusLabel(status) {
                const map = {
                    'not_visited': 'சந்திக்கவில்லை',
                    'visited': 'சந்தித்தோம் ✓',
                    'follow_up': 'மீண்டும் வர வேண்டும்'
                };
                return map[status] || 'சந்திக்கவில்லை';
            },
            getVisitStatusColor(status) {
                const map = {
                    'not_visited': 'bg-red-100 text-red-700 border-red-300',
                    'visited': 'bg-emerald-100 text-emerald-700 border-emerald-300',
                    'follow_up': 'bg-amber-100 text-amber-700 border-amber-300'
                };
                return map[status] || 'bg-red-100 text-red-700 border-red-300';
            },
            getVisitStatusBadge(status) {
                const map = {
                    'not_visited': 'bg-red-600 text-white',
                    'visited': 'bg-emerald-600 text-white',
                    'follow_up': 'bg-amber-500 text-slate-900'
                };
                return map[status] || 'bg-red-600 text-white';
            },

            // Support status UI helpers
            getSupportStatusLabel(status) {
                const map = {
                    'unknown': 'தெரியவில்லை',
                    'supporter': 'ஆதரவு ✅',
                    'opposition': 'எதிர்ப்பு ❌',
                    'undecided': 'முடிவில்லை ❓',
                    'to_convince': 'மாற்றவேண்டும் 🔄'
                };
                return map[status] || 'தெரியவில்லை';
            },
            getSupportStatusColor(status) {
                const map = {
                    'unknown': 'bg-slate-100 text-slate-500',
                    'supporter': 'bg-emerald-100 text-emerald-700 font-bold',
                    'opposition': 'bg-red-100 text-red-700 font-bold',
                    'undecided': 'bg-blue-100 text-blue-700',
                    'to_convince': 'bg-orange-100 text-orange-700'
                };
                return map[status] || 'bg-slate-100 text-slate-500';
            },

            // ===== VISIT TRACKER ACTIONS =====
            cycleVisitStatus(famId) {
                const fam = this.families.find(f => f.id === famId);
                if (!fam) return;
                const order = ['not_visited', 'visited', 'follow_up'];
                const currentIdx = order.indexOf(fam.visitStatus || 'not_visited');
                fam.visitStatus = order[(currentIdx + 1) % order.length];
                if (fam.visitStatus === 'visited') {
                    fam.visitedAt = new Date().toISOString();
                }
                this.persist();
                this.notify(`குடும்பம் ${famId}: "${this.getVisitStatusLabel(fam.visitStatus)}" என மாற்றப்பட்டது!`);
            },

            setVisitStatus(famId, status) {
                const fam = this.families.find(f => f.id === famId);
                if (!fam) return;
                fam.visitStatus = status;
                if (status === 'visited') fam.visitedAt = new Date().toISOString();
                this.persist();
                this.notify(`நிலை மாற்றப்பட்டது: ${this.getVisitStatusLabel(status)}`);
            },

            setSupportStatus(famId, status) {
                const fam = this.families.find(f => f.id === famId);
                if (!fam) return;
                fam.supportStatus = status;
                this.persist();
                this.notify(`ஆதரவு நிலை: ${this.getSupportStatusLabel(status)}`);
            },

            openNotesModal(famId) {
                const fam = this.families.find(f => f.id === famId);
                if (!fam) return;
                this.notesTargetFamilyId = famId;
                this.notesText = fam.visitNotes || '';
                this.showNotesModal = true;
            },

            saveNotes() {
                const fam = this.families.find(f => f.id === this.notesTargetFamilyId);
                if (fam) {
                    fam.visitNotes = this.notesText.trim();
                    this.persist();
                    this.notify('குறிப்புகள் சேமிக்கப்பட்டன!');
                }
                this.showNotesModal = false;
            },

            // ===== HELPER METHODS =====
            getFamilyTitle(fam) {
                if (!fam) return '';
                const headVoter = this.getVoterBySl(fam.headSlNo);
                if (headVoter) {
                    return `[${headVoter.slNo}] ${headVoter.name} குடும்பம்`;
                }
                return `குடும்பம் (${fam.id})`;
            },

            getSortedFamilyMembers(fam) {
                if (!fam || !fam.memberSlNos) return [];
                const members = fam.memberSlNos.map(sl => this.getVoterBySl(sl)).filter(Boolean);
                members.sort((a, b) => {
                    if (a.slNo === fam.headSlNo) return -1;
                    if (b.slNo === fam.headSlNo) return 1;
                    return a.slNo - b.slNo;
                });
                return members;
            },

            getVotersCountInOoru(ooruName) {
                return this.voters.filter(v => v.ooru === ooruName).length;
            },
            getFamiliesCountInOoru(ooruName) {
                return this.families.filter(f => f.ooru === ooruName).length;
            },
            getVisitedCountInOoru(ooruName) {
                return this.families.filter(f => f.ooru === ooruName && f.visitStatus === 'visited').length;
            },

            // BUG 5 FIX: Dynamic ooru tab label
            get ooruTabLabel() {
                return `ஊர் / தெருக்கள் (${this.oorus.length})`;
            },

            // ===== OORU CRUD =====
            addOoru() {
                const name = this.newOoruInput.trim();
                if (!name) { alert('தயவுசெய்து ஊர் / தெருவின் பெயரை உள்ளிடவும்!'); return; }
                if (this.oorus.includes(name)) { alert('இந்த ஊர் / தெரு ஏற்கனவே பட்டியலில் உள்ளது!'); return; }
                this.oorus.push(name);
                this.newOoruInput = '';
                this.persist();
                this.notify(`புதிய ஊர்/தெரு "${name}" சேர்க்கப்பட்டது!`);
            },

            startEditOoru(ooruName) {
                this.editingOoruOldName = ooruName;
                this.editingOoruNewName = ooruName;
            },

            saveEditOoru() {
                const oldName = this.editingOoruOldName;
                const newName = this.editingOoruNewName.trim();
                if (!newName) { alert('ஊர் பெயர் காலியாக இருக்கக்கூடாது!'); return; }
                if (oldName !== newName && this.oorus.includes(newName)) { alert('இந்த புதிய பெயர் ஏற்கனவே பட்டியலில் உள்ளது!'); return; }
                const idx = this.oorus.indexOf(oldName);
                if (idx > -1) this.oorus[idx] = newName;
                this.voters.forEach(v => { if (v.ooru === oldName) v.ooru = newName; });
                this.families.forEach(f => { if (f.ooru === oldName) f.ooru = newName; });
                this.editingOoruOldName = null;
                this.editingOoruNewName = '';
                this.persist();
                this.notify(`ஊர் பெயர் "${oldName}" -> "${newName}" என மாற்றப்பட்டது!`);
            },

            deleteOoru(ooruName) {
                const votersInOoru = this.getVotersCountInOoru(ooruName);
                const msg = votersInOoru > 0
                    ? `எச்சரிக்கை: "${ooruName}" பகுதியில் ${votersInOoru} வாக்காளர்கள் உள்ளனர். இந்த ஊரை நீக்க விரும்புகிறீர்களா?`
                    : `"${ooruName}" ஊரை நீக்கவா?`;
                if (!confirm(msg)) return;
                this.oorus = this.oorus.filter(o => o !== ooruName);
                this.persist();
                this.notify(`ஊர்/தெரு "${ooruName}" நீக்கப்பட்டது.`);
            },

            // ===== VOTER COMPUTED =====
            get unmappedVoters() { return this.voters.filter(v => !v.familyId); },

            get searchResultsForModal() {
                const unmapped = this.unmappedVoters;
                if (!this.manualSearchQuery.trim()) return unmapped.slice(0, 30);
                const q = this.manualSearchQuery.toLowerCase().trim();
                return unmapped.filter(v =>
                    String(v.slNo) === q ||
                    v.name.toLowerCase().includes(q) ||
                    v.epicNo.toLowerCase().includes(q) ||
                    v.houseNo.toLowerCase().includes(q)
                ).slice(0, 40);
            },

            get searchResultsForAddMember() {
                const unmapped = this.unmappedVoters;
                if (!this.addMemberSearchQuery.trim()) return unmapped.slice(0, 30);
                const q = this.addMemberSearchQuery.toLowerCase().trim();
                return unmapped.filter(v =>
                    String(v.slNo) === q ||
                    v.name.toLowerCase().includes(q) ||
                    v.epicNo.toLowerCase().includes(q)
                ).slice(0, 40);
            },

            get filteredVoters() {
                let list = this.voters;
                if (this.voterSearch.trim()) {
                    const q = this.voterSearch.toLowerCase().trim();
                    list = list.filter(v =>
                        v.name.toLowerCase().includes(q) ||
                        v.epicNo.toLowerCase().includes(q) ||
                        String(v.slNo).includes(q) ||
                        v.houseNo.toLowerCase().includes(q) ||
                        v.relationName.toLowerCase().includes(q)
                    );
                }
                if (this.selectedOoruFilter) {
                    if (this.selectedOoruFilter === 'UNASSIGNED') list = list.filter(v => !v.ooru);
                    else list = list.filter(v => v.ooru === this.selectedOoruFilter);
                }
                if (this.selectedStatusFilter === 'mapped') list = list.filter(v => v.familyId);
                if (this.selectedStatusFilter === 'unmapped') list = list.filter(v => !v.familyId);
                if (this.selectedGenderFilter) list = list.filter(v => v.gender === this.selectedGenderFilter);
                if (this.selectedAgeFilter) {
                    if (this.selectedAgeFilter === '18-25') list = list.filter(v => v.age >= 18 && v.age < 26);
                    if (this.selectedAgeFilter === '26-35') list = list.filter(v => v.age >= 26 && v.age < 36);
                    if (this.selectedAgeFilter === '36-50') list = list.filter(v => v.age >= 36 && v.age < 51);
                    if (this.selectedAgeFilter === '51-70') list = list.filter(v => v.age >= 51 && v.age < 71);
                    if (this.selectedAgeFilter === '71-90') list = list.filter(v => v.age >= 71 && v.age < 91);
                    if (this.selectedAgeFilter === '90+') list = list.filter(v => v.age >= 91);
                }
                return list;
            },

            get paginatedVoters() {
                const start = (this.voterPage - 1) * this.pageSize;
                return this.filteredVoters.slice(start, start + this.pageSize);
            },
            get maxVoterPages() { return Math.ceil(this.filteredVoters.length / this.pageSize) || 1; },

            // ===== FAMILY COMPUTED =====
            get filteredFamilies() {
                let list = this.families;
                if (this.familyOoruFilter) list = list.filter(f => f.ooru === this.familyOoruFilter);
                if (this.familyVisitFilter) list = list.filter(f => (f.visitStatus || 'not_visited') === this.familyVisitFilter);
                if (this.familySearch.trim()) {
                    const q = this.familySearch.toLowerCase().trim();
                    list = list.filter(f => {
                        const head = this.getVoterBySl(f.headSlNo);
                        const headName = head ? head.name.toLowerCase() : '';
                        const headSlStr = head ? String(head.slNo) : '';
                        return f.id.toLowerCase().includes(q) ||
                            f.houseNo.toLowerCase().includes(q) ||
                            (f.mobile && f.mobile.includes(q)) ||
                            headName.includes(q) || headSlStr === q;
                    });
                }
                return list;
            },

            getVoterBySl(slNo) { return this.voters.find(v => v.slNo === slNo); },

            // ===== FAMILY CRUD =====
            openManualModal(defaultOoru = null) {
                this.manualSearchQuery = '';
                const targetOoru = defaultOoru || this.familyOoruFilter || this.oorus[0] || '';
                this.manualForm = { ooru: targetOoru, houseNo: '', caste: '', mobile: '', headSlNo: null, selectedSlNos: [] };
                this.showManualModal = true;
            },

            addVoterBySearch() {
                const results = this.searchResultsForModal;
                if (results.length > 0) {
                    this.toggleVoterSelection(results[0].slNo);
                    this.manualSearchQuery = '';
                }
            },

            toggleVoterSelection(slNo) {
                const idx = this.manualForm.selectedSlNos.indexOf(slNo);
                if (idx > -1) {
                    this.manualForm.selectedSlNos.splice(idx, 1);
                    if (this.manualForm.headSlNo === slNo) this.manualForm.headSlNo = this.manualForm.selectedSlNos[0] || null;
                } else {
                    this.manualForm.selectedSlNos.push(slNo);
                    if (!this.manualForm.headSlNo) this.manualForm.headSlNo = slNo;
                    const v = this.getVoterBySl(slNo);
                    if (v && v.houseNo && !this.manualForm.houseNo) this.manualForm.houseNo = v.houseNo;
                }
            },

            saveManualFamily() {
                if (this.manualForm.selectedSlNos.length === 0) { alert('தயவுசெய்து குறைந்தபட்சம் 1 வாக்காளரைத் தேர்ந்தெடுக்கவும்!'); return; }
                if (!this.manualForm.headSlNo) { alert('தயவுசெய்து குடும்பத் தலைவரைத் தேர்ந்தெடுக்கவும்!'); return; }
                if (!this.manualForm.ooru) { alert('தயவுசெய்து ஊர் / தெருவைத் தேர்ந்தெடுக்கவும்!'); return; }

                // BUG 5 FIX: Duplicate house number warning
                const dupFam = this.families.find(f => f.houseNo === this.manualForm.houseNo.trim() && f.ooru === this.manualForm.ooru);
                if (dupFam && this.manualForm.houseNo.trim()) {
                    const headV = this.getVoterBySl(dupFam.headSlNo);
                    if (!confirm(`எச்சரிக்கை: வீடு எண் "${this.manualForm.houseNo}" - "${this.manualForm.ooru}" பகுதியில் ஏற்கனவே ஒரு குடும்பம் (${headV ? headV.name : dupFam.id}) உள்ளது. தொடரவா?`)) return;
                }

                // BUG 2 FIX: Use max-id based ID generation
                const newFamId = generateFamilyId(this.families);
                const selectedOoru = this.manualForm.ooru;

                const newFamily = {
                    id: newFamId,
                    ooru: selectedOoru,
                    houseNo: this.manualForm.houseNo.trim(),
                    caste: this.manualForm.caste.trim(),
                    mobile: this.manualForm.mobile.trim(),
                    headSlNo: this.manualForm.headSlNo,
                    memberSlNos: [...this.manualForm.selectedSlNos],
                    createdAt: new Date().toISOString(),
                    // Visit Tracker fields
                    visitStatus: VISIT_STATUS.NOT_VISITED,
                    supportStatus: SUPPORT_STATUS.UNKNOWN,
                    visitNotes: '',
                    visitedAt: null
                };

                this.manualForm.selectedSlNos.forEach(sl => {
                    const v = this.getVoterBySl(sl);
                    if (v) {
                        v.familyId = newFamId;
                        v.ooru = selectedOoru;
                        v.isHead = (sl === this.manualForm.headSlNo);
                        if (this.manualForm.caste) v.caste = this.manualForm.caste;
                        if (this.manualForm.mobile) v.mobile = this.manualForm.mobile;
                    }
                });

                this.families.push(newFamily);
                this.persist();
                this.showManualModal = false;
                this.notify(`குடும்பம் ${newFamId} உருவாக்கப்பட்டது! (${newFamily.memberSlNos.length} வாக்காளர்கள்)`);
            },

            openAddMemberToFamilyModal(famId) {
                this.targetFamilyForAddMember = this.families.find(f => f.id === famId);
                this.addMemberSearchQuery = '';
                this.showAddMemberModal = true;
            },

            addMemberToTargetFamily(slNo) {
                if (!this.targetFamilyForAddMember) return;
                const fam = this.targetFamilyForAddMember;
                const v = this.getVoterBySl(slNo);
                if (fam && v && !fam.memberSlNos.includes(slNo)) {
                    fam.memberSlNos.push(slNo);
                    v.familyId = fam.id;
                    v.ooru = fam.ooru;
                    v.isHead = false;
                    if (fam.caste) v.caste = fam.caste;
                    if (fam.mobile) v.mobile = fam.mobile;
                    this.persist();
                    this.notify(`${v.name} (வரிசை ${slNo}) குடும்பத்தில் சேர்க்கப்பட்டார்!`);
                }
            },

            openEditFamily(fam) {
                this.editingFamily = {
                    id: fam.id, ooru: fam.ooru, houseNo: fam.houseNo,
                    caste: fam.caste || '', mobile: fam.mobile || '',
                    headSlNo: fam.headSlNo, memberSlNos: [...fam.memberSlNos]
                };
                this.showEditFamilyModal = true;
            },

            saveEditFamily() {
                const famIndex = this.families.findIndex(f => f.id === this.editingFamily.id);
                if (famIndex > -1) {
                    const fam = this.families[famIndex];
                    const newOoru = this.editingFamily.ooru;
                    fam.ooru = newOoru;
                    fam.houseNo = this.editingFamily.houseNo;
                    fam.caste = this.editingFamily.caste.trim();
                    fam.mobile = this.editingFamily.mobile.trim();
                    fam.headSlNo = this.editingFamily.headSlNo;
                    fam.memberSlNos.forEach(sl => {
                        const v = this.getVoterBySl(sl);
                        if (v) {
                            v.ooru = newOoru;
                            v.isHead = (sl === fam.headSlNo);
                            v.caste = fam.caste;
                            v.mobile = fam.mobile;
                        }
                    });
                    this.persist();
                    this.showEditFamilyModal = false;
                    this.notify(`குடும்ப விவரங்கள் (${fam.id}) புதுப்பிக்கப்பட்டன!`);
                }
            },

            deleteFamily(famId) {
                const fam = this.families.find(f => f.id === famId);
                if (!fam) return;
                const headVoter = this.getVoterBySl(fam.headSlNo);
                const headName = headVoter ? headVoter.name : 'Unknown';
                if (!confirm(`எச்சரிக்கை: குடும்பம் ${famId} (${headName} - ${fam.memberSlNos.length} உறுப்பினர்கள்) நீக்கப்படவுள்ளது.\n\nதொடரவா?`)) return;
                fam.memberSlNos.forEach(sl => {
                    const v = this.getVoterBySl(sl);
                    if (v) { v.familyId = null; v.isHead = false; v.ooru = ''; }
                });
                this.families = this.families.filter(f => f.id !== famId);
                this.persist();
                this.notify(`குடும்பம் ${famId} நீக்கப்பட்டது. ${fam.memberSlNos.length} வாக்காளர்கள் மீட்கப்பட்டனர்.`);
            },

            removeMemberFromFamily(famId, slNo) {
                if (!confirm(`வரிசை எண் ${slNo} கொண்ட வாக்காளரை இந்தக் குடும்பத்திலிருந்து நீக்கவா?`)) return;
                const fam = this.families.find(f => f.id === famId);
                if (fam) {
                    fam.memberSlNos = fam.memberSlNos.filter(s => s !== slNo);
                    const v = this.getVoterBySl(slNo);
                    if (v) { v.familyId = null; v.isHead = false; v.ooru = ''; }
                    if (fam.headSlNo === slNo) {
                        fam.headSlNo = fam.memberSlNos[0] || null;
                        if (fam.headSlNo) {
                            const newHead = this.getVoterBySl(fam.headSlNo);
                            if (newHead) newHead.isHead = true;
                        }
                    }
                    if (fam.memberSlNos.length === 0) {
                        this.families = this.families.filter(f => f.id !== famId);
                        this.notify(`குடும்பம் ${famId} காலியானதால் நீக்கப்பட்டது.`);
                    } else {
                        this.notify(`வாக்காளர் ${slNo} குடும்பத்திலிருந்து நீக்கப்பட்டார்.`);
                    }
                    this.persist();
                }
            },

            // ===== PRINT HELPERS =====
            // BUG 3 FIX: Don't switch to 'print' tab, just trigger print directly
            printFamilyCard(famId) {
                this.selectedPrintFamilyId = famId;
                // Show print section briefly, print, then stay on families tab
                const prevTab = this.currentTab;
                this.currentTab = 'print';
                setTimeout(() => {
                    window.print();
                    setTimeout(() => { this.currentTab = prevTab; }, 500);
                }, 350);
            },

            printAllFamiliesInOoru(ooruName) {
                this.selectedPrintFamilyId = 'OORU_' + ooruName;
                const prevTab = this.currentTab;
                this.currentTab = 'print';
                setTimeout(() => {
                    window.print();
                    setTimeout(() => { this.currentTab = prevTab; }, 500);
                }, 350);
            },

            get printFamiliesList() {
                if (!this.selectedPrintFamilyId) return this.families;
                if (this.selectedPrintFamilyId.startsWith('OORU_')) {
                    const ooru = this.selectedPrintFamilyId.replace('OORU_', '');
                    return this.families.filter(f => f.ooru === ooru);
                }
                return this.families.filter(f => f.id === this.selectedPrintFamilyId);
            },

            exportJSON() {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
                    voters: this.voters,
                    families: this.families,
                    oorus: this.oorus
                }, null, 2));
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", "ADMK_Booth_257_Data_Backup.json");
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
                this.notify('பேக்கப் ஃபைல் டவுன்லோட் செய்யப்பட்டது!');
            },

            importJSON(event) {
                const file = event.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const data = JSON.parse(e.target.result);
                        if (data.families && data.voters && data.oorus) {
                            this.voters = data.voters;
                            this.families = data.families;
                            this.oorus = data.oorus;
                            this.persist();
                            this.notify(`வெற்றிகரமாக ${data.families.length} குடும்பங்கள் ஆப்பிற்குள் கொண்டுவரப்பட்டன!`);
                        } else {
                            alert('செல்லுபடியாகாத பேக்கப் ஃபைல்!');
                        }
                    } catch (err) {
                        alert('கோப்பைப் படிப்பதில் பிழை ஏற்பட்டது!');
                    }
                };
                reader.readAsText(file);
            },

            resetData() {
                if (confirm('எச்சரிக்கை: நீங்கள் உருவாக்கிய அனைத்து குடும்பத் தரவுகளையும் அழித்து, துவக்க நிலைக்கு மாற்ற விரும்புகிறீர்களா?')) {
                    localStorage.removeItem(ACTIVE_KEY_VOTERS);
                    localStorage.removeItem(ACTIVE_KEY_FAMILIES);
                    localStorage.removeItem(ACTIVE_KEY_OORUS);
                    // BUG 3 FIX: Explicitly reload fresh data
                    this.voters = JSON.parse(JSON.stringify(window.INITIAL_VOTERS || []));
                    this.families = [];
                    this.oorus = JSON.parse(JSON.stringify(window.INITIAL_OORUS || []));
                    this.persist();
                    this.notify('தரவுகள் துவக்க நிலைக்கு மீட்கப்பட்டன!');
                }
            },

            // BUG 1 FIX: CSV Export properly creates anchor element
            exportCSV() {
                const csvHeader = 'Serial No,EPIC No,Voter Name,Relation Type,Relation Name,House No,Age,Gender,Ooru,Family ID,Is Head,Mobile,Visit Status,Support Status\n';
                const rows = this.voters.map(v => {
                    const fam = v.familyId ? this.families.find(f => f.id === v.familyId) : null;
                    return [
                        v.slNo,
                        `"${v.epicNo}"`,
                        `"${v.name}"`,
                        `"${v.relationType}"`,
                        `"${v.relationName}"`,
                        `"${v.houseNo}"`,
                        v.age,
                        `"${v.gender}"`,
                        `"${v.ooru || 'Unassigned'}"`,
                        `"${v.familyId || ''}"`,
                        v.isHead ? 'YES' : 'NO',
                        `"${v.mobile || ''}"`,
                        `"${fam ? (fam.visitStatus || 'not_visited') : ''}"`,
                        `"${fam ? (fam.supportStatus || 'unknown') : ''}"`
                    ].join(',');
                });

                const csvContent = '\uFEFF' + csvHeader + rows.join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                // BUG 1 FIX: Properly create anchor element
                const a = document.createElement('a');
                a.href = url;
                a.download = 'ADMK_Booth_257_Voters_Master.csv';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        };
    };
})();
