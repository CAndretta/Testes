(function ($) {
    const STORAGE_KEY = "calculadora-materiais-state";

    const state = loadState();

    $(function () {
        bindEvents();
        renderAll();
        registerServiceWorker();
    });

    function loadState() {
        const fallback = { materials: [], pieces: [] };
        const rawState = window.localStorage.getItem(STORAGE_KEY);

        if (!rawState) {
            return fallback;
        }

        try {
            const parsed = JSON.parse(rawState);
            return {
                materials: Array.isArray(parsed.materials) ? parsed.materials : [],
                pieces: Array.isArray(parsed.pieces) ? parsed.pieces : []
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
        $("#material-form").on("submit", handleMaterialSubmit);
        $("#piece-form").on("submit", handlePieceSubmit);
        $("#materials-table-body").on("click", ".delete-material", handleDeleteMaterial);
        $("#pieces-table-body").on("click", ".delete-piece", handleDeletePiece);
        $("#clear-data").on("click", handleClearData);
    }

    function handleMaterialSubmit(event) {
        event.preventDefault();

        const name = $("#material-name").val().trim();
        const price = Number($("#material-price").val());

        if (!name || Number.isNaN(price) || price < 0) {
            window.alert("Informe um material valido e um preco maior ou igual a zero.");
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
    }

    function handlePieceSubmit(event) {
        event.preventDefault();

        if (!state.materials.length) {
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

        state.pieces.push(piece);
        persistState();
        renderAll();
        event.currentTarget.reset();
        $("#piece-quantity").val("1");
    }

    function handleDeleteMaterial(event) {
        const materialId = $(event.currentTarget).data("id");
        const pieceUsingMaterial = state.pieces.some(function (piece) {
            return piece.materialId === materialId;
        });

        if (pieceUsingMaterial) {
            window.alert("Remova primeiro as pecas vinculadas a este material.");
            return;
        }

        state.materials = state.materials.filter(function (material) {
            return material.id !== materialId;
        });
        persistState();
        renderAll();
    }

    function handleDeletePiece(event) {
        const pieceId = $(event.currentTarget).data("id");
        state.pieces = state.pieces.filter(function (piece) {
            return piece.id !== pieceId;
        });
        persistState();
        renderAll();
    }

    function handleClearData() {
        if (!window.confirm("Deseja remover todos os materiais e pecas salvos localmente?")) {
            return;
        }

        state.materials = [];
        state.pieces = [];
        persistState();
        renderAll();
        $("#material-form")[0].reset();
        $("#piece-form")[0].reset();
        $("#piece-quantity").val("1");
    }

    function renderAll() {
        renderMaterials();
        renderMaterialSelect();
        renderPieces();
        renderSummary();
    }

    function renderMaterials() {
        const body = $("#materials-table-body");
        body.empty();

        if (!state.materials.length) {
            body.append('<tr class="empty-state-row"><td colspan="3">Nenhum material cadastrado.</td></tr>');
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
        });
    }

    function renderMaterialSelect() {
        const select = $("#piece-material");
        const currentValue = select.val();

        select.empty();
        select.append('<option value="">Selecione um material</option>');

        state.materials.forEach(function (material) {
            select.append(
                $("<option>")
                    .attr("value", material.id)
                    .text(material.name + " - " + formatCurrency(material.price) + "/m²")
            );
        });

        if (currentValue && state.materials.some(function (material) { return material.id === currentValue; })) {
            select.val(currentValue);
        }
    }

    function renderPieces() {
        const body = $("#pieces-table-body");
        body.empty();

        if (!state.pieces.length) {
            body.append('<tr class="empty-state-row"><td colspan="5">Nenhuma peca adicionada.</td></tr>');
            return;
        }

        state.pieces.forEach(function (piece) {
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
        const totals = calculateTotals();
        const breakdown = calculateMaterialBreakdown();
        const breakdownRoot = $("#material-breakdown");
        const template = document.getElementById("breakdown-item-template");

        $("#summary-material-count").text(state.materials.length);
        $("#summary-piece-count").text(state.pieces.length);
        $("#summary-total-cost").text(formatCurrency(totals.totalCost));

        $("#total-area").text(formatArea(totals.totalAreaSqm));
        $("#total-cost").text(formatCurrency(totals.totalCost));
        $("#average-cost").text(formatCurrency(totals.averageCost));

        breakdownRoot.empty();

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
        const totalAreaSqm = state.pieces.reduce(function (sum, piece) {
            return sum + calculatePieceMetrics(piece).totalAreaSqm;
        }, 0);
        const totalCost = state.pieces.reduce(function (sum, piece) {
            return sum + calculatePieceMetrics(piece).totalCost;
        }, 0);

        return {
            totalAreaSqm,
            totalCost,
            averageCost: state.pieces.length ? totalCost / state.pieces.length : 0
        };
    }

    function calculateMaterialBreakdown() {
        const grouped = {};

        state.pieces.forEach(function (piece) {
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
        });
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