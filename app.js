(function ($) {
    const STORAGE_KEY = "calculadora-materiais-state";
    const DEFAULT_TAB = "composition";
    const EMPTY_PROJECT_OPTION = '<option value="">Selecione um projeto</option>';

    const state = loadState();

    $(function () {
        bindEvents();
        renderAll();
        registerServiceWorker();
    });

    function loadState() {
        const fallback = { projects: [], selectedProjectId: "" };
        const rawState = window.localStorage.getItem(STORAGE_KEY);

        if (!rawState) {
            return fallback;
        }

        try {
            const parsed = JSON.parse(rawState);

            if (Array.isArray(parsed.projects)) {
                const projects = parsed.projects.map(normalizeProject).filter(Boolean);
                const selectedProjectId = projects.some(function (project) {
                    return project.id === parsed.selectedProjectId;
                }) ? parsed.selectedProjectId : (projects[0] ? projects[0].id : "");

                return {
                    projects,
                    selectedProjectId
                };
            }

            if (Array.isArray(parsed.materials) || Array.isArray(parsed.pieces)) {
                const migratedProjectId = createId("project");

                return {
                    projects: [{
                        id: migratedProjectId,
                        name: "Projeto migrado",
                        materials: Array.isArray(parsed.materials) ? parsed.materials.map(normalizeMaterial).filter(Boolean) : [],
                        pieces: Array.isArray(parsed.pieces) ? parsed.pieces.map(normalizePiece).filter(Boolean) : []
                    }],
                    selectedProjectId: migratedProjectId
                };
            }

            return {
                projects: [],
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
        $("#material-form").on("submit", handleMaterialSubmit);
        $("#piece-form").on("submit", handlePieceSubmit);
        $("#materials-table-body").on("click", ".delete-material", handleDeleteMaterial);
        $("#pieces-table-body").on("click", ".delete-piece", handleDeletePiece);
        $("#clear-data").on("click", handleClearData);
        $(".tab-button").on("click", handleTabChange);
    }

    function handleTabChange(event) {
        setActiveTab($(event.currentTarget).data("tab-target"));
    }

    function handleProjectSubmit(event) {
        event.preventDefault();

        const name = $("#project-name").val().trim();

        if (!name) {
            window.alert("Informe um nome valido para o projeto.");
            return;
        }

        const projectId = createId("project");

        state.projects.push({
            id: projectId,
            name,
            materials: [],
            pieces: []
        });
        state.selectedProjectId = projectId;

        persistState();
        renderAll();
        event.currentTarget.reset();
    }

    function handleProjectChange(event) {
        state.selectedProjectId = $(event.currentTarget).val();
        persistState();
        renderAll();
    }

    function handleDeleteProject() {
        const project = getSelectedProject();

        if (!project) {
            window.alert("Selecione um projeto para excluir.");
            return;
        }

        if (!window.confirm('Deseja excluir o projeto "' + project.name + '" e todos os itens vinculados a ele?')) {
            return;
        }

        state.projects = state.projects.filter(function (entry) {
            return entry.id !== project.id;
        });
        state.selectedProjectId = state.projects[0] ? state.projects[0].id : "";
        resetForms();
        persistState();
        renderAll();
    }

    function handleMaterialSubmit(event) {
        event.preventDefault();
        const project = getSelectedProject();

        if (!project) {
            window.alert("Crie ou selecione um projeto antes de cadastrar materiais.");
            return;
        }

        const name = $("#material-name").val().trim();
        const price = Number($("#material-price").val());

        if (!name || Number.isNaN(price) || price < 0) {
            window.alert("Informe um material valido e um preco maior ou igual a zero.");
            return;
        }

        project.materials.push({
            id: createId("material"),
            name,
            price
        });

        persistState();
        renderAll();
        event.currentTarget.reset();
    }

    function handlePieceSubmit(event) {
        event.preventDefault();
        const project = getSelectedProject();

        if (!project) {
            window.alert("Crie ou selecione um projeto antes de adicionar pecas.");
            return;
        }

        if (!project.materials.length) {
            window.alert("Cadastre ao menos um material antes de adicionar pecas.");
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
            window.alert("Preencha todos os campos da peca com valores validos.");
            return;
        }

        project.pieces.push(piece);
        persistState();
        renderAll();
        event.currentTarget.reset();
        $("#piece-quantity").val("1");
    }

    function handleDeleteMaterial(event) {
        const project = getSelectedProject();
        const materialId = $(event.currentTarget).data("id");
        const pieceUsingMaterial = project && project.pieces.some(function (piece) {
            return piece.materialId === materialId;
        });

        if (pieceUsingMaterial) {
            window.alert("Remova primeiro as pecas vinculadas a este material.");
            return;
        }

        if (!project) {
            return;
        }

        project.materials = project.materials.filter(function (material) {
            return material.id !== materialId;
        });
        persistState();
        renderAll();
    }

    function handleDeletePiece(event) {
        const project = getSelectedProject();
        const pieceId = $(event.currentTarget).data("id");

        if (!project) {
            return;
        }

        project.pieces = project.pieces.filter(function (piece) {
            return piece.id !== pieceId;
        });
        persistState();
        renderAll();
    }

    function handleClearData() {
        const project = getSelectedProject();

        if (!project) {
            window.alert("Selecione um projeto para limpar os dados.");
            return;
        }

        if (!window.confirm('Deseja remover todos os materiais e pecas do projeto "' + project.name + '"?')) {
            return;
        }

        project.materials = [];
        project.pieces = [];
        persistState();
        renderAll();
        resetForms();
    }

    function renderAll() {
        renderTabs();
        renderProjects();
        renderProjectContext();
        renderMaterials();
        renderMaterialSelect();
        renderPieces();
        renderSummary();
    }

    function renderTabs() {
        setActiveTab(getActiveTab());
    }

    function getActiveTab() {
        const activeButton = $(".tab-button.is-active").first();
        return activeButton.data("tab-target") || DEFAULT_TAB;
    }

    function setActiveTab(tabName) {
        const nextTab = tabName || DEFAULT_TAB;

        $(".tab-button").each(function () {
            const button = $(this);
            const isActive = button.data("tab-target") === nextTab;

            button.toggleClass("is-active", isActive);
            button.attr("aria-selected", String(isActive));
            button.attr("tabindex", isActive ? "0" : "-1");
        });

        $(".tab-panel").each(function () {
            const panel = $(this);
            const isActive = panel.data("tab-panel") === nextTab;

            panel.toggleClass("is-active", isActive);
            panel.prop("hidden", !isActive);
        });
    }

    function renderMaterials() {
        const project = getSelectedProject();
        const body = $("#materials-table-body");
        body.empty();

        if (!project) {
            body.append('<tr class="empty-state-row"><td colspan="3">Crie ou selecione um projeto para cadastrar materiais.</td></tr>');
            return;
        }

        if (!project.materials.length) {
            body.append('<tr class="empty-state-row"><td colspan="3">Nenhum material cadastrado.</td></tr>');
            return;
        }

        project.materials.forEach(function (material) {
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

        project.materials.forEach(function (material) {
            select.append(
                $("<option>")
                    .attr("value", material.id)
                    .text(material.name + " - " + formatCurrency(material.price) + "/m²")
            );
        });

        select.prop("disabled", project.materials.length === 0);

        if (currentValue && project.materials.some(function (material) { return material.id === currentValue; })) {
            select.val(currentValue);
        }
    }

    function renderPieces() {
        const project = getSelectedProject();
        const body = $("#pieces-table-body");
        body.empty();

        if (!project) {
            body.append('<tr class="empty-state-row"><td colspan="5">Crie ou selecione um projeto para adicionar pecas.</td></tr>');
            return;
        }

        if (!project.pieces.length) {
            body.append('<tr class="empty-state-row"><td colspan="5">Nenhuma peca adicionada.</td></tr>');
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
        });
    }

    function renderSummary() {
        const project = getSelectedProject();
        const totals = calculateTotals();
        const breakdown = calculateMaterialBreakdown();
        const breakdownRoot = $("#material-breakdown");
        const template = document.getElementById("breakdown-item-template");

        $("#summary-material-count").text(project ? project.materials.length : 0);
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
        const project = getSelectedProject();
        const material = project ? project.materials.find(function (entry) {
            return entry.id === piece.materialId;
        }) : null;
        const areaPerPieceSqm = (piece.widthCm * piece.heightCm) / 10000;
        const totalAreaSqm = areaPerPieceSqm * piece.quantity;
        const totalCost = totalAreaSqm * (material ? material.price : 0);

        return {
            material,
            totalAreaSqm,
            totalCost
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
            materials: Array.isArray(project.materials) ? project.materials.map(normalizeMaterial).filter(Boolean) : [],
            pieces: Array.isArray(project.pieces) ? project.pieces.map(normalizePiece).filter(Boolean) : []
        };
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
        }

        $("#delete-project").prop("disabled", !state.selectedProjectId);
    }

    function renderProjectContext() {
        const project = getSelectedProject();
        const hasProject = Boolean(project);
        const projectName = hasProject ? project.name : "Nenhum projeto selecionado";

        $("#project-helper").text(hasProject ? 'Projeto ativo: ' + project.name + '. Os cadastros e o consolidado abaixo pertencem somente a ele.' : "Crie um projeto para cadastrar os materiais, itens e gerar um consolidado separado.");
        $("#material-form :input").prop("disabled", !hasProject);
        $("#piece-form :input").not("#piece-material").prop("disabled", !hasProject);
        $("#clear-data").prop("disabled", !hasProject);

        ["#piece-project-badge", "#material-project-badge", "#summary-project-badge"].forEach(function (selector) {
            $(selector)
                .text(projectName)
                .prop("hidden", !hasProject);
        });
    }

    function resetForms() {
        if ($("#material-form")[0]) {
            $("#material-form")[0].reset();
        }

        if ($("#piece-form")[0]) {
            $("#piece-form")[0].reset();
        }

        $("#piece-quantity").val("1");
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
        if (!("serviceWorker" in navigator)) {
            return;
        }

        navigator.serviceWorker.register("./sw.js").catch(function (error) {
            console.warn("Nao foi possivel registrar o service worker.", error);
        });
    }
}(jQuery));