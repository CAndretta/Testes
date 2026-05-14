(function ($) {
    const STORAGE_KEY = "calculadora-materiais-state";
    const DEFAULT_TAB = "composition";
    const EMPTY_PROJECT_OPTION = '<option value="">Selecione um projeto</option>';
    const SETTINGS_PANEL_OPEN_CLASS = "is-open";
    const LOCAL_PROTOCOL = "file:";
    const TOAST_DURATION_MS = 3200;

    const state = loadState();
    const uiState = {
        projectPickerOpen: !state.selectedProjectId,
        confirmResolver: null,
        toastTimer: 0
    };

    $(function () {
        bindEvents();
        renderAll();
        registerServiceWorker();
    });

    function loadState() {
        const fallback = { projects: [], materials: [], selectedProjectId: "" };
        const rawState = window.localStorage.getItem(STORAGE_KEY);

        if (!rawState) {
            return fallback;
        }

        try {
            const parsed = JSON.parse(rawState);

            if (Array.isArray(parsed.projects)) {
                const projects = parsed.projects.map(normalizeProject).filter(Boolean);
                const materials = collectGlobalMaterials(parsed);
                const selectedProjectId = "";

                return {
                    projects,
                    materials,
                    selectedProjectId
                };
            }

            if (Array.isArray(parsed.materials) || Array.isArray(parsed.pieces)) {
                const migratedProjectId = createId("project");

                return {
                    materials: Array.isArray(parsed.materials) ? parsed.materials.map(normalizeMaterial).filter(Boolean) : [],
                    projects: [{
                        id: migratedProjectId,
                        name: "Projeto migrado",
                        pieces: Array.isArray(parsed.pieces) ? parsed.pieces.map(normalizePiece).filter(Boolean) : []
                    }],
                    selectedProjectId: migratedProjectId
                };
            }

            return {
                projects: [],
                materials: [],
                selectedProjectId: ""
            };
        } catch (error) {
            console.warn("Nao foi possivel carregar o estado salvo.", error);
            return fallback;
        }
    }

    function persistState() {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function bindEvents() {
        $("#project-form").on("submit", handleProjectSubmit);
        $("#project-select").on("change", handleProjectChange);
        $("#delete-project").on("click", handleDeleteProject);
        $("#toggle-project-picker").on("click", toggleProjectPicker);
        $("#hero-start-action").on("click", handleHeroStartAction);
        $("#hero-material-action, #quick-add-material").on("click", openCostSettings);
        $("#material-form").on("submit", handleMaterialSubmit);
        $("#piece-form").on("submit", handlePieceSubmit);
        $("#materials-table-body, #materials-mobile-list").on("click", ".delete-material", handleDeleteMaterial);
        $("#pieces-table-body, #pieces-mobile-list").on("click", ".delete-piece", handleDeletePiece);
        $("#clear-data").on("click", handleClearData);
        $(".tab-button").on("click", handleTabChange);
        $("#open-cost-settings").on("click", openCostSettings);
        $("#close-cost-settings, #cost-settings-overlay").on("click", closeCostSettings);
        $("#confirm-cancel, #confirm-overlay").on("click", handleConfirmCancel);
        $("#confirm-accept").on("click", handleConfirmAccept);
        $("#piece-form").on("input change", "input, select", renderPieceEstimate);
        $("#material-form").on("input change", "input", handleMaterialInput);
        $(document).on("keydown", handleGlobalKeydown);
    }

    function handleHeroStartAction() {
        openProjectPicker();
        scrollToElement("#project-heading");
    }

    function openCostSettings() {
        const panel = $("#cost-settings-panel");
        const overlay = $("#cost-settings-overlay");

        panel.prop("hidden", false).attr("aria-hidden", "false").addClass(SETTINGS_PANEL_OPEN_CLASS);
        overlay.prop("hidden", false).addClass(SETTINGS_PANEL_OPEN_CLASS);
        $("#open-cost-settings").attr("aria-expanded", "true");
        $("body").addClass("has-settings-open");
        window.setTimeout(function () {
            $("#material-name").trigger("focus");
        }, 0);
    }

    function closeCostSettings() {
        const panel = $("#cost-settings-panel");
        const overlay = $("#cost-settings-overlay");

        panel.removeClass(SETTINGS_PANEL_OPEN_CLASS).attr("aria-hidden", "true").prop("hidden", true);
        overlay.removeClass(SETTINGS_PANEL_OPEN_CLASS).prop("hidden", true);
        $("#open-cost-settings").attr("aria-expanded", "false").trigger("focus");
        $("body").removeClass("has-settings-open");
    }

    function handleGlobalKeydown(event) {
        if (uiState.confirmResolver && event.key === "Escape") {
            resolveConfirmation(false);
            return;
        }

        if (event.key === "Escape" && $("body").hasClass("has-settings-open")) {
            closeCostSettings();
        }
    }

    function handleConfirmCancel() {
        resolveConfirmation(false);
    }

    function handleConfirmAccept() {
        resolveConfirmation(true);
    }

    function handleTabChange(event) {
        setActiveTab($(event.currentTarget).data("tab-target"));
        renderJourneySteps();
    }

    function handleProjectSubmit(event) {
        event.preventDefault();

        const name = $("#project-name").val().trim();

        if (!name) {
            showToast("Informe um nome valido para o projeto.", "warning");
            $("#project-name").trigger("focus");
            return;
        }

        const projectId = createId("project");

        state.projects.push({
            id: projectId,
            name,
            pieces: []
        });
        state.selectedProjectId = projectId;
        uiState.projectPickerOpen = false;

        persistState();
        renderAll();
        event.currentTarget.reset();
        showToast('Projeto "' + name + '" criado.', "success");
        setActiveTab("composition");
    }

    function handleProjectChange(event) {
        state.selectedProjectId = $(event.currentTarget).val();

        if (state.selectedProjectId) {
            uiState.projectPickerOpen = false;
            resetForms();
            showToast("Projeto carregado para edicao.", "success");
        }

        persistState();
        renderAll();
    }

    async function handleDeleteProject() {
        const project = getSelectedProject();

        if (!project) {
            showToast("Selecione um projeto para excluir.", "warning");
            return;
        }

        if (!(await requestConfirmation({
            title: "Excluir projeto",
            copy: 'Deseja excluir o projeto "' + project.name + '" e todos os itens vinculados a ele?',
            confirmLabel: "Excluir projeto",
            tone: "danger"
        }))) {
            return;
        }

        state.projects = state.projects.filter(function (entry) {
            return entry.id !== project.id;
        });
        state.selectedProjectId = "";
        uiState.projectPickerOpen = true;
        resetForms();
        persistState();
        renderAll();
        showToast("Projeto removido.", "success");
    }

    function handleMaterialSubmit(event) {
        event.preventDefault();

        const name = $("#material-name").val().trim();
        const price = Number($("#material-price").val());

        if (!name || Number.isNaN(price) || price < 0) {
            setFormMessage("#material-form-message", "Informe um material valido e um preco maior ou igual a zero.", "warning");
            $("#material-name").trigger("focus");
            return;
        }

        state.materials.push({
            id: createId("material"),
            name,
            price
        });

        persistState();
        renderAll();
        event.currentTarget.reset();
        clearFormMessage("#material-form-message");
        showToast('Material "' + name + '" salvo na base de custos.', "success");
        $("#material-name").trigger("focus");
    }

    function handlePieceSubmit(event) {
        event.preventDefault();
        const project = getSelectedProject();

        if (!project) {
            setFormMessage("#piece-form-message", "Crie ou selecione um projeto antes de adicionar pecas.", "warning");
            openProjectPicker();
            return;
        }

        if (!state.materials.length) {
            setFormMessage("#piece-form-message", "Cadastre ao menos um material antes de adicionar pecas.", "warning");
            openCostSettings();
            return;
        }

        const piece = {
            id: createId("piece"),
            name: $("#piece-name").val().trim(),
            widthCm: Number($("#piece-width").val()),
            heightCm: Number($("#piece-height").val()),
            quantity: Number($("#piece-quantity").val()),
            materialId: $("#piece-material").val()
        };

        if (!piece.name || piece.widthCm <= 0 || piece.heightCm <= 0 || piece.quantity <= 0 || !piece.materialId) {
            setFormMessage("#piece-form-message", "Preencha todos os campos da peca com valores validos.", "warning");
            return;
        }

        project.pieces.push(piece);
        persistState();
        renderAll();
        event.currentTarget.reset();
        $("#piece-quantity").val("1");
        clearFormMessage("#piece-form-message");
        renderPieceEstimate();
        showToast('Peca "' + piece.name + '" adicionada ao projeto.', "success");
    }

    async function handleDeleteMaterial(event) {
        const materialId = $(event.currentTarget).data("id");
        const material = state.materials.find(function (entry) {
            return entry.id === materialId;
        });
        const pieceUsingMaterial = state.projects.some(function (project) {
            return project.pieces.some(function (piece) {
                return piece.materialId === materialId;
            });
        });

        if (pieceUsingMaterial) {
            showToast("Remova primeiro as pecas vinculadas a este material.", "warning");
            return;
        }

        if (!(await requestConfirmation({
            title: "Excluir material",
            copy: 'Deseja remover o material "' + (material ? material.name : "selecionado") + '" da base de custos?',
            confirmLabel: "Excluir material",
            tone: "danger"
        }))) {
            return;
        }

        state.materials = state.materials.filter(function (material) {
            return material.id !== materialId;
        });
        persistState();
        renderAll();
        showToast("Material removido.", "success");
    }

    async function handleDeletePiece(event) {
        const project = getSelectedProject();
        const pieceId = $(event.currentTarget).data("id");
        let removedPiece = null;

        if (!project) {
            return;
        }

        removedPiece = project.pieces.find(function (piece) {
            return piece.id === pieceId;
        }) || null;

        if (!(await requestConfirmation({
            title: "Excluir peca",
            copy: 'Deseja remover a peca "' + (removedPiece ? removedPiece.name : "selecionada") + '" deste projeto?',
            confirmLabel: "Excluir peca",
            tone: "danger"
        }))) {
            return;
        }

        project.pieces = project.pieces.filter(function (piece) {
            return piece.id !== pieceId;
        });
        persistState();
        renderAll();
        showToast("Peca removida.", "success");
    }

    async function handleClearData() {
        const project = getSelectedProject();

        if (!project) {
            showToast("Selecione um projeto para limpar os dados.", "warning");
            return;
        }

        if (!(await requestConfirmation({
            title: "Limpar pecas do projeto",
            copy: 'Deseja remover todas as pecas do projeto "' + project.name + '"? A base de custos sera mantida para todos os projetos.',
            confirmLabel: "Limpar pecas",
            tone: "danger"
        }))) {
            return;
        }

        project.pieces = [];
        persistState();
        renderAll();
        resetForms();
        showToast("Pecas do projeto removidas.", "success");
    }

    function handleMaterialInput() {
        clearFormMessage("#material-form-message");
    }

    function renderAll() {
        renderRuntimeNotice();
        renderTabs();
        renderJourneySteps();
        renderProjects();
        renderProjectContext();
        renderMaterials();
        renderMaterialSelect();
        renderPieces();
        renderSummary();
        renderPieceEstimate();
    }

    function renderRuntimeNotice() {
        const notice = $("#runtime-notice");
        const runtime = getRuntimeContext();

        if (!runtime.message) {
            notice.prop("hidden", true).removeClass("is-warning is-success").empty();
            return;
        }

        notice
            .prop("hidden", false)
            .removeClass("is-warning is-success")
            .addClass(runtime.tone === "success" ? "is-success" : "is-warning")
            .html("<strong>" + escapeHtml(runtime.title) + "</strong><span>" + escapeHtml(runtime.message) + "</span>");
    }

    function getRuntimeContext() {
        if (window.location.protocol === LOCAL_PROTOCOL) {
            return {
                tone: "warning",
                title: "Modo arquivo local",
                message: "Os dados seguem salvos no navegador, mas instalacao PWA e cache offline dependem de abrir a pasta por um servidor local."
            };
        }

        if (!("serviceWorker" in navigator) || !window.isSecureContext) {
            return {
                tone: "warning",
                title: "Modo navegador",
                message: "A calculadora funciona normalmente, mas os recursos PWA dependem de um contexto seguro para ativar o service worker."
            };
        }

        return {
            tone: "success",
            title: "PWA pronto",
            message: "Persistencia local e recursos offline estao disponiveis neste ambiente."
        };
    }

    function renderTabs() {
        if (!getSelectedProject()) {
            $(".tab-button").removeClass("is-active").attr("aria-selected", "false").attr("tabindex", "-1");
            $(".tab-panel").removeClass("is-active").prop("hidden", true);
            return;
        }

        setActiveTab(getActiveTab());
    }

    function getActiveTab() {
        const activeButton = $(".tab-button.is-active").first();
        return activeButton.data("tab-target") || DEFAULT_TAB;
    }

    function setActiveTab(tabName) {
        const requestedTab = tabName || DEFAULT_TAB;
        const availableTab = $(".tab-button").filter(function () {
            return $(this).data("tab-target") === requestedTab;
        }).length ? requestedTab : DEFAULT_TAB;

        $(".tab-button").each(function () {
            const button = $(this);
            const isActive = button.data("tab-target") === availableTab;

            button.toggleClass("is-active", isActive);
            button.attr("aria-selected", String(isActive));
            button.attr("tabindex", isActive ? "0" : "-1");
        });

        $(".tab-panel").each(function () {
            const panel = $(this);
            const isActive = panel.data("tab-panel") === availableTab;

            panel.toggleClass("is-active", isActive);
            panel.prop("hidden", !isActive);
        });
    }

    function renderMaterials() {
        const body = $("#materials-table-body");
        const mobileList = $("#materials-mobile-list");
        body.empty();
        mobileList.empty();
        mobileList.prop("hidden", false);

        if (!state.materials.length) {
            body.append('<tr class="empty-state-row"><td colspan="3">Nenhum material cadastrado.</td></tr>');
            mobileList.append('<article class="mobile-card mobile-empty-card"><strong>Nenhum material cadastrado.</strong><p>Abra a base de custos e cadastre o primeiro material para habilitar o formulario de pecas.</p></article>');
            return;
        }

        state.materials.forEach(function (material) {
            body.append(
                $("<tr>")
                    .append($("<td>").text(material.name))
                    .append($("<td>").text(formatCurrency(material.price) + " / m²"))
                    .append(
                        $("<td>").append(
                            $("<button>")
                                .attr("type", "button")
                                .addClass("table-action danger delete-material")
                                .attr("data-id", material.id)
                                .text("Excluir")
                        )
                    )
            );

            mobileList.append(
                $("<article>")
                    .addClass("mobile-card")
                    .append(
                        $("<div>")
                            .addClass("mobile-card-topbar")
                            .append($("<strong>").text(material.name))
                            .append($("<span>").addClass("mobile-value").text(formatCurrency(material.price) + " / m²"))
                    )
                    .append($("<p>").addClass("mobile-card-copy").text("Disponivel em todos os projetos cadastrados."))
                    .append(
                        $("<div>")
                            .addClass("mobile-card-actions")
                            .append(
                                $("<button>")
                                    .attr("type", "button")
                                    .addClass("table-action danger delete-material")
                                    .attr("data-id", material.id)
                                    .text("Excluir")
                            )
                    )
            );
        });
    }

    function renderMaterialSelect() {
        const project = getSelectedProject();
        const select = $("#piece-material");
        const currentValue = select.val();

        select.empty();
        select.append('<option value="">Selecione um material</option>');

        if (!project) {
            select.prop("disabled", true);
            return;
        }

        state.materials.forEach(function (material) {
            select.append(
                $("<option>")
                    .attr("value", material.id)
                    .text(material.name + " - " + formatCurrency(material.price) + "/m²")
            );
        });

        select.prop("disabled", state.materials.length === 0);

        if (currentValue && state.materials.some(function (material) { return material.id === currentValue; })) {
            select.val(currentValue);
        }
    }

    function renderPieces() {
        const project = getSelectedProject();
        const body = $("#pieces-table-body");
        const mobileList = $("#pieces-mobile-list");
        body.empty();
        mobileList.empty();
        mobileList.prop("hidden", false);

        if (!project) {
            body.append('<tr class="empty-state-row"><td colspan="5">Crie ou selecione um projeto para adicionar pecas.</td></tr>');
            mobileList.append('<article class="mobile-card mobile-empty-card"><strong>Selecione um projeto.</strong><p>O fluxo de pecas e consolidado sera liberado assim que houver um projeto ativo.</p></article>');
            return;
        }

        if (!project.pieces.length) {
            body.append('<tr class="empty-state-row"><td colspan="5">Nenhuma peca adicionada.</td></tr>');
            mobileList.append('<article class="mobile-card mobile-empty-card"><strong>Nenhuma peca adicionada.</strong><p>Preencha a peca acima para visualizar os itens deste projeto em formato compacto.</p></article>');
            return;
        }

        project.pieces.forEach(function (piece) {
            const metrics = calculatePieceMetrics(piece);

            body.append(
                $("<tr>")
                    .append(
                        $("<td>").html(
                            "<strong>" + escapeHtml(piece.name) + "</strong><br><small>" +
                            piece.quantity + " un. de " + formatMeasurement(piece.widthCm) + " x " + formatMeasurement(piece.heightCm) +
                            "</small>"
                        )
                    )
                    .append($("<td>").text(metrics.material ? metrics.material.name : "Material removido"))
                    .append($("<td>").text(formatArea(metrics.totalAreaSqm)))
                    .append($("<td>").text(formatCurrency(metrics.totalCost)))
                    .append(
                        $("<td>").append(
                            $("<button>")
                                .attr("type", "button")
                                .addClass("table-action danger delete-piece")
                                .attr("data-id", piece.id)
                                .text("Excluir")
                        )
                    )
            );

            mobileList.append(
                $("<article>")
                    .addClass("mobile-card")
                    .append(
                        $("<div>")
                            .addClass("mobile-card-topbar")
                            .append($("<strong>").text(piece.name))
                            .append($("<span>").addClass("mobile-value").text(formatCurrency(metrics.totalCost)))
                    )
                    .append(
                        $("<dl>")
                            .addClass("mobile-metrics")
                            .append($("<div>").append($("<dt>").text("Material")).append($("<dd>").text(metrics.material ? metrics.material.name : "Material removido")))
                            .append($("<div>").append($("<dt>").text("Medidas")).append($("<dd>").text(piece.quantity + " un. de " + formatMeasurement(piece.widthCm) + " x " + formatMeasurement(piece.heightCm))))
                            .append($("<div>").append($("<dt>").text("Area total")).append($("<dd>").text(formatArea(metrics.totalAreaSqm))))
                    )
                    .append(
                        $("<div>")
                            .addClass("mobile-card-actions")
                            .append(
                                $("<button>")
                                    .attr("type", "button")
                                    .addClass("table-action danger delete-piece")
                                    .attr("data-id", piece.id)
                                    .text("Excluir")
                            )
                    )
            );
        });
    }

    function renderSummary() {
        const project = getSelectedProject();
        const totals = calculateTotals();
        const breakdown = calculateMaterialBreakdown();
        const breakdownRoot = $("#material-breakdown");
        const template = document.getElementById("breakdown-item-template");

        $("#summary-material-count").text(state.materials.length);
        $("#summary-piece-count").text(project ? project.pieces.length : 0);
        $("#summary-total-cost").text(formatCurrency(totals.totalCost));

        $("#total-area").text(formatArea(totals.totalAreaSqm));
        $("#total-cost").text(formatCurrency(totals.totalCost));
        $("#average-cost").text(formatCurrency(totals.averageCost));

        breakdownRoot.empty();

        if (!project) {
            breakdownRoot.append('<p class="empty-breakdown">Crie ou selecione um projeto para visualizar o consolidado.</p>');
            return;
        }

        if (!breakdown.length) {
            breakdownRoot.append('<p class="empty-breakdown">Adicione materiais e pecas para visualizar o resumo.</p>');
            return;
        }

        breakdown.forEach(function (item) {
            const node = template.content.firstElementChild.cloneNode(true);

            $(node).find(".breakdown-name").text(item.materialName);
            $(node).find(".breakdown-meta").text(item.pieceCount + " item(ns) | " + formatArea(item.totalAreaSqm));
            $(node).find(".breakdown-cost").text(formatCurrency(item.totalCost));
            breakdownRoot.append(node);
        });
    }

    function calculateTotals() {
        const project = getSelectedProject();

        if (!project) {
            return {
                totalAreaSqm: 0,
                totalCost: 0,
                averageCost: 0
            };
        }

        const totalAreaSqm = project.pieces.reduce(function (sum, piece) {
            return sum + calculatePieceMetrics(piece).totalAreaSqm;
        }, 0);
        const totalCost = project.pieces.reduce(function (sum, piece) {
            return sum + calculatePieceMetrics(piece).totalCost;
        }, 0);

        return {
            totalAreaSqm,
            totalCost,
            averageCost: project.pieces.length ? totalCost / project.pieces.length : 0
        };
    }

    function calculateMaterialBreakdown() {
        const project = getSelectedProject();
        const grouped = {};

        if (!project) {
            return [];
        }

        project.pieces.forEach(function (piece) {
            const metrics = calculatePieceMetrics(piece);
            const key = metrics.material ? metrics.material.id : "missing";

            if (!grouped[key]) {
                grouped[key] = {
                    materialName: metrics.material ? metrics.material.name : "Material removido",
                    pieceCount: 0,
                    totalAreaSqm: 0,
                    totalCost: 0
                };
            }

            grouped[key].pieceCount += 1;
            grouped[key].totalAreaSqm += metrics.totalAreaSqm;
            grouped[key].totalCost += metrics.totalCost;
        });

        return Object.values(grouped).sort(function (left, right) {
            return right.totalCost - left.totalCost;
        });
    }

    function calculatePieceMetrics(piece) {
        const material = state.materials.find(function (entry) {
            return entry.id === piece.materialId;
        }) || null;
        const areaPerPieceSqm = (piece.widthCm * piece.heightCm) / 10000;
        const totalAreaSqm = areaPerPieceSqm * piece.quantity;
        const totalCost = totalAreaSqm * (material ? material.price : 0);

        return {
            material,
            totalAreaSqm,
            totalCost
        };
    }

    function renderJourneySteps() {
        const activeTab = getActiveTab();
        const hasProject = Boolean(getSelectedProject());
        const hasMaterials = state.materials.length > 0;
        const hasPieces = hasProject && getSelectedProject().pieces.length > 0;

        $(".journey-step").each(function () {
            const step = $(this).data("step");
            let status = "upcoming";

            if (step === "project") {
                status = hasProject ? "complete" : "active";
            }

            if (step === "materials") {
                if (!hasProject) {
                    status = "upcoming";
                } else if (hasMaterials) {
                    status = "complete";
                } else {
                    status = "active";
                }
            }

            if (step === "pieces") {
                if (!hasProject || !hasMaterials) {
                    status = "upcoming";
                } else if (activeTab === "composition") {
                    status = "active";
                } else if (hasPieces) {
                    status = "complete";
                }
            }

            if (step === "summary") {
                if (!hasProject || !hasPieces) {
                    status = "upcoming";
                } else if (activeTab === "summary") {
                    status = "active";
                } else {
                    status = "complete";
                }
            }

            $(this)
                .attr("data-state", status)
                .toggleClass("is-complete", status === "complete")
                .toggleClass("is-active", status === "active");
        });
    }

    function renderPieceEstimate() {
        const estimate = calculateDraftPieceMetrics();
        const estimateRoot = $("#piece-estimate");
        const helper = $("#piece-form-helper");

        if (!estimate.hasInput) {
            estimateRoot.html("<strong>Previa da peca</strong><p>Preencha os campos para visualizar area e custo estimado.</p>");
            helper.text("Informe dimensoes e quantidade para ver a estimativa antes de salvar.");
            return;
        }

        helper.text(estimate.helperText);
        estimateRoot.html(
            "<strong>Previa da peca</strong>" +
            "<p>Area estimada: " + escapeHtml(formatArea(estimate.totalAreaSqm)) + "</p>" +
            "<p>Custo estimado: " + escapeHtml(formatCurrency(estimate.totalCost)) + "</p>"
        );
    }

    function calculateDraftPieceMetrics() {
        const widthCm = Number($("#piece-width").val());
        const heightCm = Number($("#piece-height").val());
        const quantity = Number($("#piece-quantity").val() || 0);
        const materialId = $("#piece-material").val();
        const material = state.materials.find(function (entry) {
            return entry.id === materialId;
        }) || null;
        const hasInput = Boolean($("#piece-name").val().trim() || widthCm || heightCm || quantity || materialId);

        if (widthCm <= 0 || heightCm <= 0 || quantity <= 0) {
            return {
                hasInput,
                totalAreaSqm: 0,
                totalCost: 0,
                helperText: state.materials.length ? "Complete largura, altura e quantidade para calcular a previa." : "Cadastre um material para liberar a estimativa de custo."
            };
        }

        return {
            hasInput,
            totalAreaSqm: (widthCm * heightCm * quantity) / 10000,
            totalCost: ((widthCm * heightCm * quantity) / 10000) * (material ? material.price : 0),
            helperText: material ? "Os valores abaixo antecipam o impacto desta peca no consolidado." : "Selecione um material para calcular o custo estimado desta peca."
        };
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL"
        }).format(value || 0);
    }

    function formatArea(value) {
        return new Intl.NumberFormat("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value || 0) + " m²";
    }

    function formatMeasurement(value) {
        return new Intl.NumberFormat("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value || 0) + " cm";
    }

    function createId(prefix) {
        return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
    }

    function normalizeProject(project) {
        if (!project || !project.id || !project.name) {
            return null;
        }

        return {
            id: String(project.id),
            name: String(project.name),
            pieces: Array.isArray(project.pieces) ? project.pieces.map(normalizePiece).filter(Boolean) : []
        };
    }

    function collectGlobalMaterials(parsed) {
        const rawGlobalMaterials = Array.isArray(parsed.materials) ? parsed.materials : [];
        const rawProjectMaterials = Array.isArray(parsed.projects) ? parsed.projects.flatMap(function (project) {
            return Array.isArray(project.materials) ? project.materials : [];
        }) : [];
        const materialMap = new Map();

        rawGlobalMaterials.concat(rawProjectMaterials).forEach(function (material) {
            const normalizedMaterial = normalizeMaterial(material);

            if (!normalizedMaterial || materialMap.has(normalizedMaterial.id)) {
                return;
            }

            materialMap.set(normalizedMaterial.id, normalizedMaterial);
        });

        return Array.from(materialMap.values());
    }

    function normalizeMaterial(material) {
        if (!material || !material.id || !material.name) {
            return null;
        }

        return {
            id: String(material.id),
            name: String(material.name),
            price: Number(material.price) || 0
        };
    }

    function normalizePiece(piece) {
        if (!piece || !piece.id || !piece.name || !piece.materialId) {
            return null;
        }

        return {
            id: String(piece.id),
            name: String(piece.name),
            widthCm: Number(piece.widthCm) || 0,
            heightCm: Number(piece.heightCm) || 0,
            quantity: Number(piece.quantity) || 0,
            materialId: String(piece.materialId)
        };
    }

    function getSelectedProject() {
        return state.projects.find(function (project) {
            return project.id === state.selectedProjectId;
        }) || null;
    }

    function renderProjects() {
        const select = $("#project-select");
        const currentValue = state.selectedProjectId;

        select.empty();
        select.append(EMPTY_PROJECT_OPTION);

        state.projects.forEach(function (project) {
            select.append(
                $("<option>")
                    .attr("value", project.id)
                    .text(project.name)
            );
        });

        if (currentValue && state.projects.some(function (project) { return project.id === currentValue; })) {
            select.val(currentValue);
        } else {
            select.val("");
        }

        $("#delete-project").prop("disabled", !state.selectedProjectId);
    }

    function renderProjectContext() {
        const project = getSelectedProject();
        const hasProject = Boolean(project);
        const projectName = hasProject ? project.name : "Nenhum projeto selecionado";
        const shouldShowPicker = uiState.projectPickerOpen;

        $("#project-heading").text(hasProject ? "Projeto em andamento" : "Abra um projeto antes de cadastrar");
        $("#project-helper").text(hasProject ? 'Projeto ativo: ' + project.name + '. Use o botao acima para trocar de contexto sem misturar o preenchimento atual.' : "Selecione um projeto existente ou crie um novo para liberar o preenchimento das pecas e do consolidado.");
        $("#toggle-project-picker")
            .text(hasProject ? "Trocar ou criar outro projeto" : "Selecionar ou criar projeto")
            .attr("aria-expanded", String(shouldShowPicker));
        $("#hero-start-action").text(hasProject ? "Trocar projeto" : "Comecar projeto");
        $("#hero-material-action").text(state.materials.length ? "Editar base de custos" : "Base de custos");
        $("#project-picker-panel").prop("hidden", !shouldShowPicker);
        $("#project-workspace").prop("hidden", !hasProject);
        $("#material-form :input").prop("disabled", false);
        $("#piece-form :input").not("#piece-material").prop("disabled", !hasProject);
        $("#piece-material").prop("disabled", !hasProject || state.materials.length === 0);
        $("#clear-data").prop("disabled", !hasProject);
        $("#quick-add-material").prop("disabled", false);

        ["#piece-project-badge", "#summary-project-badge"].forEach(function (selector) {
            $(selector)
                .text(projectName)
                .prop("hidden", !hasProject);
        });

        $("#material-project-badge")
            .text("Disponivel para todos os projetos")
            .prop("hidden", false);

        if (!hasProject) {
            clearFormMessage("#piece-form-message");
        }
    }

    function toggleProjectPicker() {
        uiState.projectPickerOpen = !uiState.projectPickerOpen;

        if (uiState.projectPickerOpen) {
            openProjectPicker();
            return;
        }

        renderProjectContext();
    }

    function openProjectPicker() {
        uiState.projectPickerOpen = true;
        renderProjectContext();
        window.setTimeout(function () {
            if (state.projects.length) {
                $("#project-select").trigger("focus");
                return;
            }

            $("#project-name").trigger("focus");
        }, 0);
    }

    function resetForms() {
        if ($("#material-form")[0]) {
            $("#material-form")[0].reset();
        }

        if ($("#piece-form")[0]) {
            $("#piece-form")[0].reset();
        }

        $("#piece-quantity").val("1");
        clearFormMessage("#material-form-message");
        clearFormMessage("#piece-form-message");
        renderPieceEstimate();
    }

    function setFormMessage(selector, message, tone) {
        $(selector)
            .prop("hidden", false)
            .attr("data-tone", tone || "warning")
            .text(message);
    }

    function clearFormMessage(selector) {
        $(selector)
            .prop("hidden", true)
            .removeAttr("data-tone")
            .empty();
    }

    function showToast(message, tone) {
        const toastRegion = $("#toast-region");
        const toast = $("<article>")
            .addClass("toast")
            .attr("data-tone", tone || "success")
            .text(message);

        window.clearTimeout(uiState.toastTimer);
        toastRegion.empty().append(toast);
        uiState.toastTimer = window.setTimeout(function () {
            toast.fadeOut(180, function () {
                $(this).remove();
            });
        }, TOAST_DURATION_MS);
    }

    function requestConfirmation(options) {
        const settings = options || {};
        const confirmDialog = $("#confirm-dialog");
        const confirmOverlay = $("#confirm-overlay");

        $("#confirm-title").text(settings.title || "Confirmar acao");
        $("#confirm-copy").text(settings.copy || "Revise a acao antes de continuar.");
        $("#confirm-accept")
            .text(settings.confirmLabel || "Confirmar")
            .attr("data-tone", settings.tone || "danger");

        confirmOverlay.prop("hidden", false);
        confirmDialog.prop("hidden", false);

        return new Promise(function (resolve) {
            uiState.confirmResolver = resolve;
            window.setTimeout(function () {
                $("#confirm-cancel").trigger("focus");
            }, 0);
        });
    }

    function resolveConfirmation(accepted) {
        const resolver = uiState.confirmResolver;

        if (!resolver) {
            return;
        }

        uiState.confirmResolver = null;
        $("#confirm-dialog").prop("hidden", true);
        $("#confirm-overlay").prop("hidden", true);
        resolver(Boolean(accepted));
    }

    function scrollToElement(selector) {
        const node = $(selector)[0];

        if (!node || typeof node.scrollIntoView !== "function") {
            return;
        }

        node.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function registerServiceWorker() {
        if (!("serviceWorker" in navigator) || !window.isSecureContext || window.location.protocol === LOCAL_PROTOCOL) {
            return;
        }

        navigator.serviceWorker.register("./sw.js").catch(function (error) {
            console.warn("Nao foi possivel registrar o service worker.", error);
        });
    }
}(jQuery));