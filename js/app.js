// ==========================================
// FiadoBot Pro - JavaScript Principal
// ==========================================

// Inicialização do DB
let db = {
    clients: [],
    products: [],
    sales: [],
    expenses: [],
    version: '2.1'
};

let currentMonth = new Date().toISOString().slice(0, 7);
let clientToDelete = null;
let currentFilter = null;
let currentSaleTotal = 0;
let currentDiscount = 0;

// ==========================================
// FUNÇÕES DE DADOS
// ==========================================

function loadData() {
    const saved = localStorage.getItem('fiadobot_db_v2');
    if (saved) {
        try {
            db = JSON.parse(saved);
        } catch (e) {
            console.error('Erro ao carregar dados:', e);
        }
    }
    updateUI();
}

function saveData() {
    localStorage.setItem('fiadobot_db_v2', JSON.stringify(db));
    updateUI();
}

// ==========================================
// ATUALIZAÇÃO DA INTERFACE
// ==========================================

function updateUI() {
    updateSummary();
    renderSummary();
    renderDashboardAlerts();
    renderClients();
    renderProducts();
    renderSales();
    renderReports();
    updateSaleClientSelect();
}

function updateSummary() {
    const totalBalance = db.clients.reduce((sum, c) => sum + (c.balance || 0), 0);
    const monthSales = db.sales.filter(s => s.date.startsWith(currentMonth) && s.type === 'sale');
    const monthRevenue = monthSales.reduce((sum, s) => sum + s.total, 0);
    const monthCost = monthSales.reduce((sum, s) => sum + (s.costTotal || 0), 0);
    const monthProfit = monthRevenue - monthCost;

    document.getElementById('totalBalance').textContent = formatCurrency(totalBalance);
    document.getElementById('totalClients').textContent = db.clients.length;
    document.getElementById('totalProducts').textContent = db.products.length;
    document.getElementById('monthProfit').textContent = formatCurrency(monthProfit);
    document.getElementById('monthProfit').style.color = monthProfit >= 0 ? 'var(--success)' : 'var(--danger)';
}

// ==========================================
// ABA RESUMO (PRINCIPAL)
// ==========================================

function renderSummary() {
    const totalReceivable = db.clients.reduce((sum, c) => sum + (c.balance || 0), 0);
    const monthSales = db.sales.filter(s => s.date.startsWith(currentMonth) && s.type === 'sale');
    const monthRevenue = monthSales.reduce((sum, s) => sum + s.total, 0);
    const totalTransactions = db.sales.length;
    const avgTicket = monthSales.length > 0 ? monthRevenue / monthSales.length : 0;

    document.getElementById('summaryReceivable').textContent = formatCurrency(totalReceivable);
    document.getElementById('summaryMonthSales').textContent = formatCurrency(monthRevenue);
    document.getElementById('summaryTicket').textContent = formatCurrency(avgTicket);
    document.getElementById('summaryTransactions').textContent = totalTransactions;
}

function renderDashboardAlerts() {
    const container = document.getElementById('dashboardAlerts');
    let html = '';

    // Top 3 devedores
    const debtors = db.clients
        .filter(c => (c.balance || 0) > 0)
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 3);

    if (debtors.length > 0) {
        html += `
            <div class="alert-card danger">
                <div class="alert-title">🔴 Maiores Devedores</div>
                <div class="debtor-list">
                    ${debtors.map(d => `
                        <div class="debtor-item">
                            <span class="debtor-name">${d.name}</span>
                            <span class="debtor-amount">${formatCurrency(d.balance)}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // Estoque baixo
    const lowStock = db.products.filter(p => (p.stock || 0) < 5);
    if (lowStock.length > 0) {
        html += `
            <div class="alert-card warning">
                <div class="alert-title">⚠️ Estoque Baixo</div>
                <div class="low-stock-grid">
                    ${lowStock.slice(0, 4).map(p => `
                        <div class="stock-item ${(p.stock || 0) === 0 ? 'critical' : ''}">
                            <div class="stock-name">${p.name}</div>
                            <div class="stock-qty">${p.stock || 0} un</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

// ==========================================
// ABA CLIENTES
// ==========================================

function renderClients(filter = '') {
    const container = document.getElementById('clientsList');
    let clients = db.clients.sort((a, b) => (b.balance || 0) - (a.balance || 0));
    
    if (currentFilter === 'debtors') {
        clients = clients.filter(c => (c.balance || 0) > 0);
    }
    
    if (filter) {
        clients = clients.filter(c => 
            c.name.toLowerCase().includes(filter.toLowerCase()) ||
            (c.phone && c.phone.includes(filter))
        );
    }

    if (clients.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">👥</div>
                <p>${filter ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = clients.map(client => `
        <div class="client-item">
            <div class="client-info">
                <div class="client-name">${client.name}</div>
                <div class="client-balance ${(client.balance || 0) > 0 ? 'positive' : (client.balance || 0) < 0 ? 'negative' : ''}">
                    ${(client.balance || 0) > 0 ? 'Deve:' : (client.balance || 0) < 0 ? 'Crédito:' : 'Sem débito:'} 
                    ${formatCurrency(Math.abs(client.balance || 0))}
                </div>
                ${client.phone ? `<small style="color:var(--text-secondary)">📱 ${client.phone}</small>` : ''}
            </div>
            <div class="client-actions">
                <button class="btn btn-icon btn-view" onclick="viewClientHistory('${client.id}')" title="Ver histórico">👁️</button>
                <button class="btn btn-icon btn-edit" onclick="editClient('${client.id}')" title="Editar">✏️</button>
                <button class="btn btn-icon btn-delete" onclick="confirmDeleteClient('${client.id}')" title="Excluir">🗑️</button>
                ${(client.balance || 0) > 0 ? `
                    <button class="btn btn-success btn-sm" onclick="openPaymentModal('${client.id}')">Receber</button>
                    <button class="btn btn-sm btn-secondary" onclick="openTransferModal('${client.id}')">↔️</button>
                ` : ''}
                <button class="btn btn-primary btn-sm" onclick="quickSale('${client.id}')">⚡ Vender</button>
            </div>
        </div>
    `).join('');
}

function toggleFilter(filter) {
    if (currentFilter === filter) {
        currentFilter = null;
    } else {
        currentFilter = filter;
    }
    renderClients();
}

function searchClients(query) {
    renderClients(query);
}

function editClient(clientId) {
    const client = db.clients.find(c => c.id === clientId);
    if (!client) return;

    document.getElementById('clientModalTitle').textContent = '✏️ Editar Cliente';
    document.getElementById('clientId').value = client.id;
    document.getElementById('clientName').value = client.name;
    document.getElementById('clientPhone').value = client.phone || '';
    document.getElementById('clientLimit').value = client.limit || '';

    document.getElementById('clientModal').classList.add('active');
}

function confirmDeleteClient(clientId) {
    const client = db.clients.find(c => c.id === clientId);
    if (!client) return;

    if ((client.balance || 0) > 0) {
        alert('❌ Não é possível excluir um cliente que possui débitos pendentes.\n\nReceba o pagamento primeiro.');
        return;
    }

    clientToDelete = clientId;
    document.getElementById('confirmText').textContent = `Tem certeza que deseja excluir o cliente "${client.name}" permanentemente?`;
    document.getElementById('confirmModal').classList.add('active');
}

function executeDelete() {
    if (!clientToDelete) return;

    db.clients = db.clients.filter(c => c.id !== clientToDelete);
    saveData();
    closeModal('confirmModal');
    clientToDelete = null;
}

function viewClientHistory(clientId) {
    const client = db.clients.find(c => c.id === clientId);
    if (!client) return;
    
    const history = db.sales.filter(s => s.clientId === clientId || (s.type === 'payment' && s.clientId === clientId));
    let html = `<h3 style="color:var(--accent); margin-bottom:15px;">📋 Histórico de ${client.name}</h3><div style="max-height:400px; overflow-y:auto;">`;
    
    if (history.length === 0) {
        html += '<p style="color:var(--text-secondary); text-align:center; padding:20px;">Nenhuma transação encontrada</p>';
    } else {
        history.slice().reverse().forEach(h => {
            if (h.type === 'sale') {
                html += `
                <div style="padding:12px; border-bottom:1px solid var(--border); border-left:3px solid var(--accent); margin-bottom:8px; background:var(--primary); border-radius:0 8px 8px 0;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                        <strong>Venda ${h.saleType === 'fiado' ? 'fiado' : h.saleType === 'parcelado' ? 'parcelado' : 'à vista'}</strong>
                        <span>${formatCurrency(h.total)}</span>
                    </div>
                    <div style="font-size:0.85rem; color:var(--text-secondary);">
                        ${formatDate(h.date)} • ${h.items ? h.items.length + ' item(s)' : ''}
                    </div>
                    ${h.notes ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px; font-style:italic;">"${h.notes}"</div>` : ''}
                </div>`;
            } else if (h.type === 'payment') {
                html += `
                <div style="padding:12px; border-bottom:1px solid var(--border); border-left:3px solid var(--success); margin-bottom:8px; background:var(--primary); border-radius:0 8px 8px 0;">
                    <div style="display:flex; justify-content:space-between; color:var(--success); margin-bottom:4px;">
                        <strong>💰 Pagamento recebido</strong>
                        <span>${formatCurrency(h.amount)}</span>
                    </div>
                    <div style="font-size:0.85rem; color:var(--text-secondary);">
                        ${formatDate(h.date)} ${h.isPartial ? '• (Parcial)' : ''} ${h.remainingBalance > 0 ? '• Resta: ' + formatCurrency(h.remainingBalance) : ''}
                    </div>
                </div>`;
            }
        });
    }
    
    html += '</div>';
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <span class="modal-title">📋 Histórico</span>
                <button class="modal-close" onclick="this.closest('.modal').remove()">&times;</button>
            </div>
            <div class="modal-body">${html}</div>
        </div>
    `;
    document.body.appendChild(modal);
}

function quickSale(clientId) {
    openSaleModal();
    document.getElementById('saleClient').value = clientId;
}

// ==========================================
// ABA PRODUTOS
// ==========================================

function renderProducts() {
    const container = document.getElementById('productsList');
    let products = db.products;
    
    if (currentFilter === 'lowStock') {
        products = products.filter(p => (p.stock || 0) < 5);
    }
    
    if (products.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📦</div>
                <p>Nenhum produto cadastrado</p>
            </div>
        `;
        return;
    }

    container.innerHTML = products.map(product => {
        const profit = product.price - product.cost;
        const margin = ((profit / product.price) * 100).toFixed(1);
        const stockClass = (product.stock || 0) < 5 ? 'color:var(--danger)' : '';
        return `
        <div class="product-item">
            <div class="product-info">
                <div class="product-name">${product.name}</div>
                <div class="product-stats">
                    <span>💰 Custo: ${formatCurrency(product.cost)}</span>
                    <span>🏷️ Venda: ${formatCurrency(product.price)}</span>
                    <span>📈 Lucro: ${formatCurrency(profit)} (${margin}%)</span>
                    <span style="${stockClass}">📦 Estoque: ${product.stock || 0}</span>
                </div>
                ${product.category ? `<span class="badge badge-warning">${product.category}</span>` : ''}
            </div>
            <button class="btn btn-primary btn-sm" onclick="editProduct('${product.id}')">Editar</button>
        </div>
    `}).join('');
}

function editProduct(productId) {
    const product = db.products.find(p => p.id === productId);
    if (!product) return;
    
    const newPrice = prompt(`Novo preço para ${product.name}:`, product.price);
    const newStock = prompt(`Novo estoque para ${product.name}:`, product.stock);
    const newBarcode = prompt(`Novo código de barras para ${product.name}:`, product.barcode || '');
    
    if (newPrice !== null) product.price = parseFloat(newPrice) || product.price;
    if (newStock !== null) product.stock = parseInt(newStock) || product.stock;
    if (newBarcode !== null) product.barcode = newBarcode;
    
    saveData();
}

// ==========================================
// ABA VENDAS
// ==========================================

function renderSales() {
    const container = document.getElementById('salesList');
    const sales = db.sales.slice().reverse();
    
    if (sales.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🛒</div>
                <p>Nenhuma venda registrada</p>
            </div>
        `;
        return;
    }

    container.innerHTML = sales.map(sale => {
        const client = db.clients.find(c => c.id === sale.clientId);
        const isPayment = sale.type === 'payment';
        const isExpense = sale.type === 'expense';
        
        let icon, title, amountClass;
        if (isPayment) {
            icon = '💰'; title = 'Pagamento recebido'; amountClass = 'positive';
        } else if (isExpense) {
            icon = '💸'; title = sale.description || 'Despesa'; amountClass = 'negative';
        } else {
            icon = '🛒'; 
            title = `Venda ${sale.saleType === 'fiado' ? 'fiado' : sale.saleType === 'parcelado' ? 'parcelado' : 'à vista'} - ${client ? client.name : 'Cliente'}`; 
            amountClass = 'positive';
        }

        return `
        <div class="transaction-item">
            <div class="transaction-icon">${icon}</div>
            <div class="transaction-details">
                <div class="transaction-title">${title}</div>
                <div class="transaction-meta">${formatDate(sale.date)} ${sale.notes ? '• ' + sale.notes : ''}</div>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
                <div class="transaction-amount ${amountClass}">
                    ${isExpense ? '-' : '+'} ${formatCurrency(sale.total || sale.amount)}
                </div>
                ${!isPayment && !isExpense ? `<button class="btn btn-icon" onclick="repeatSale('${sale.id}')" title="Repetir">↻</button>` : ''}
            </div>
        </div>
    `}).join('');
}

// CORREÇÃO: Função repeatSale completa
function repeatSale(saleId) {
    const sale = db.sales.find(s => s.id === saleId);
    if (!sale || sale.type !== 'sale') return;

    openSaleModal();
    document.getElementById('saleClient').value = sale.clientId || '';
    document.getElementById('saleType').value = sale.saleType;
    
    // Selecionar mesmos produtos
    setTimeout(() => {
        sale.items.forEach(item => {
            const el = document.querySelector(`.product-select-item[data-id="${item.productId}"]`);
            if (el) {
                el.classList.add('selected');
                el.querySelector('input[type="checkbox"]').checked = true;
                const qtyInput = el.querySelector('input[type="number"]');
                if (qtyInput) {
                    qtyInput.value = item.quantity;
                }
            }
        });
        updateSaleTotal();
    }, 100);
}

// ==========================================
// ABA RELATÓRIOS
// ==========================================

function renderReports() {
    const months = [...new Set(db.sales.map(s => s.date.slice(0, 7)))].sort().reverse();
    const selector = document.getElementById('monthSelector');
    selector.innerHTML = months.map(m => `
        <button class="month-btn ${m === currentMonth ? 'active' : ''}" onclick="setReportMonth('${m}')">
            ${formatMonth(m)}
        </button>
    `).join('');

    const monthSales = db.sales.filter(s => s.date.startsWith(currentMonth) && s.type === 'sale');
    const revenue = monthSales.reduce((sum, s) => sum + s.total, 0);
    const cost = monthSales.reduce((sum, s) => sum + (s.costTotal || 0), 0);
    const profit = revenue - cost;
    const margin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;

    document.getElementById('reportRevenue').textContent = formatCurrency(revenue);
    document.getElementById('reportCost').textContent = formatCurrency(cost);
    document.getElementById('reportProfit').textContent = formatCurrency(profit);
    document.getElementById('reportProfit').className = 'stat-value ' + (profit >= 0 ? 'profit' : 'loss');
    document.getElementById('reportMargin').textContent = margin + '%';

    const productStats = {};
    monthSales.forEach(sale => {
        sale.items.forEach(item => {
            if (!productStats[item.productId]) {
                const product = db.products.find(p => p.id === item.productId);
                productStats[item.productId] = {
                    name: product ? product.name : 'Produto removido',
                    quantity: 0,
                    revenue: 0,
                    cost: 0
                };
            }
            productStats[item.productId].quantity += item.quantity;
            productStats[item.productId].revenue += item.price * item.quantity;
            productStats[item.productId].cost += item.cost * item.quantity;
        });
    });

    const reportContainer = document.getElementById('productReport');
    const sortedProducts = Object.entries(productStats).sort((a, b) => b[1].quantity - a[1].quantity);
    
    if (sortedProducts.length === 0) {
        reportContainer.innerHTML = '<p style="text-align:center; color:var(--text-secondary); padding:20px">Nenhuma venda no período</p>';
        return;
    }

    reportContainer.innerHTML = sortedProducts.map(([id, stat]) => {
        const profit = stat.revenue - stat.cost;
        const margin = ((profit / stat.revenue) * 100).toFixed(1);
        return `
        <div style="padding:15px; border-bottom:1px solid var(--border)">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px">
                <strong>${stat.name}</strong>
                <span class="badge badge-success">${stat.quantity} vendidos</span>
            </div>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; font-size:0.9rem; color:var(--text-secondary)">
                <div>Receita: <strong>${formatCurrency(stat.revenue)}</strong></div>
                <div>Custo: <strong>${formatCurrency(stat.cost)}</strong></div>
                <div>Lucro: <strong style="color:${profit >= 0 ? 'var(--success)' : 'var(--danger)'}">${formatCurrency(profit)} (${margin}%)</strong></div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width:${Math.min((stat.quantity / sortedProducts[0][1].quantity) * 100, 100)}%"></div>
            </div>
        </div>
    `}).join('');
}

function setReportMonth(month) {
    currentMonth = month;
    renderReports();
}

// ==========================================
// MODAIS - ABERTURA E FECHAMENTO
// ==========================================

function openActionMenu() {
    document.getElementById('actionMenu').classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function openClientModal() {
    closeModal('actionMenu');
    document.getElementById('clientModalTitle').textContent = '👤 Novo Cliente';
    document.getElementById('clientId').value = '';
    document.getElementById('clientName').value = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('clientLimit').value = '';
    document.getElementById('clientModal').classList.add('active');
    document.getElementById('clientName').focus();
}

function openProductModal() {
    closeModal('actionMenu');
    document.getElementById('productModal').classList.add('active');
    document.getElementById('productName').focus();
}

function openSaleModal() {
    closeModal('actionMenu');
    updateSaleProducts();
    renderTopProducts();
    document.getElementById('saleModal').classList.add('active');
    document.getElementById('barcodeSearch').focus();
}

function openExpenseModal() {
    closeModal('actionMenu');
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('expenseModal').classList.add('active');
}

function openPaymentModal(clientId = null) {
    const select = document.getElementById('paymentClient');
    const debtors = db.clients.filter(c => (c.balance || 0) > 0);
    
    select.innerHTML = debtors.map(c => 
        `<option value="${c.id}" ${c.id === clientId ? 'selected' : ''}>${c.name} (Deve ${formatCurrency(c.balance)})</option>`
    ).join('');
    
    updatePaymentAmount();
    document.getElementById('paymentModal').classList.add('active');
}

function openTransferModal(clientId = null) {
    const fromSelect = document.getElementById('transferFrom');
    const toSelect = document.getElementById('transferTo');
    
    const debtors = db.clients.filter(c => (c.balance || 0) > 0);
    fromSelect.innerHTML = debtors.map(c => 
        `<option value="${c.id}" ${c.id === clientId ? 'selected' : ''}>${c.name} (${formatCurrency(c.balance)})</option>`
    ).join('');
    
    const others = db.clients.filter(c => c.id !== clientId);
    toSelect.innerHTML = others.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    
    updateTransferAmount();
    document.getElementById('transferModal').classList.add('active');
}

// ==========================================
// VENDA - PRODUTOS E CÁLCULOS
// ==========================================

function updateSaleProducts() {
    const container = document.getElementById('saleProducts');
    container.innerHTML = db.products.map(p => `
        <div class="product-select-item" onclick="toggleProduct(this, '${p.id}')" data-id="${p.id}" data-price="${p.price}" data-cost="${p.cost}">
            <input type="checkbox" style="width:20px; height:20px; cursor:pointer">
            <div style="flex:1">
                <strong>${p.name}</strong>
                <div style="font-size:0.85rem; color:var(--text-secondary)">
                    ${formatCurrency(p.price)} • Estoque: ${p.stock || 0}
                </div>
            </div>
            <input type="number" class="form-input" placeholder="Qtd" style="width:70px" min="1" value="1" onchange="updateSaleTotal()" onclick="event.stopPropagation()">
        </div>
    `).join('');
}

function toggleProduct(el, id) {
    el.classList.toggle('selected');
    const checkbox = el.querySelector('input[type="checkbox"]');
    checkbox.checked = !checkbox.checked;
    updateSaleTotal();
}

function renderTopProducts() {
    const stats = {};
    db.sales.filter(s => s.type === 'sale').forEach(sale => {
        sale.items.forEach(item => {
            if (!stats[item.productId]) stats[item.productId] = 0;
            stats[item.productId] += item.quantity;
        });
    });
    
    const topIds = Object.entries(stats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);
    
    const container = document.getElementById('topProducts');
    const section = document.getElementById('topProductsSection');
    
    if (topIds.length === 0) {
        section.style.display = 'none';
        return;
    }
    
    section.style.display = 'block';
    container.innerHTML = topIds.map(id => {
        const product = db.products.find(p => p.id === id);
        if (!product) return '';
        return `
            <div class="top-product-chip" onclick="addTopProduct('${id}')">
                ${product.name} (${formatCurrency(product.price)})
            </div>
        `;
    }).join('');
}

function addTopProduct(productId) {
    const el = document.querySelector(`.product-select-item[data-id="${productId}"]`);
    if (el && !el.classList.contains('selected')) {
        el.classList.add('selected');
        el.querySelector('input[type="checkbox"]').checked = true;
        updateSaleTotal();
    }
}

function handleBarcodeSearch(event) {
    if (event.key !== 'Enter') return;
    
    const code = event.target.value.trim();
    if (!code) return;
    
    const product = db.products.find(p => p.barcode === code || p.id === code);
    if (!product) {
        alert('Produto não encontrado');
        return;
    }
    
    const el = document.querySelector(`.product-select-item[data-id="${product.id}"]`);
    if (el) {
        if (!el.classList.contains('selected')) {
            el.classList.add('selected');
            el.querySelector('input[type="checkbox"]').checked = true;
        } else {
            const qtyInput = el.querySelector('input[type="number"]');
            qtyInput.value = parseInt(qtyInput.value) + 1;
        }
        updateSaleTotal();
    }
    
    event.target.value = '';
    event.target.focus();
}

function handleSaleTypeChange() {
    const type = document.getElementById('saleType').value;
    document.getElementById('paymentGroup').style.display = type === 'avista' ? 'block' : 'none';
    document.getElementById('installmentSection').style.display = type === 'parcelado' ? 'block' : 'none';
    updateSaleTotal();
}

function updateSaleTotal() {
    const items = document.querySelectorAll('.product-select-item.selected');
    let subtotal = 0;
    let costTotal = 0;
    
    items.forEach(item => {
        const price = parseFloat(item.dataset.price);
        const cost = parseFloat(item.dataset.cost);
        const qty = parseInt(item.querySelector('input[type="number"]').value) || 1;
        subtotal += price * qty;
        costTotal += cost * qty;
    });

    currentSaleTotal = subtotal;
    const total = subtotal - currentDiscount;

    document.getElementById('saleSubtotal').textContent = formatCurrency(subtotal);
    document.getElementById('saleTotal').textContent = formatCurrency(total);
    document.getElementById('saleTotal').dataset.cost = costTotal;
    document.getElementById('saleTotal').dataset.subtotal = subtotal;

    document.getElementById('discountRow').style.display = currentDiscount > 0 ? 'flex' : 'none';
    document.getElementById('saleDiscount').textContent = '- ' + formatCurrency(currentDiscount);

    if (document.getElementById('installmentSection').style.display !== 'none') {
        calculateInstallments();
    }
}

function applyDiscount() {
    currentDiscount = parseFloat(document.getElementById('discountValue').value) || 0;
    document.getElementById('discountPercent').value = '';
    updateSaleTotal();
}

function applyDiscountPercent() {
    const percent = parseFloat(document.getElementById('discountPercent').value) || 0;
    currentDiscount = (currentSaleTotal * percent) / 100;
    document.getElementById('discountValue').value = currentDiscount.toFixed(2);
    updateSaleTotal();
}

function calculateChange() {
    const paid = parseFloat(document.getElementById('salePayment').value) || 0;
    const total = currentSaleTotal - currentDiscount;
    const change = paid - total;
    
    const changeRow = document.getElementById('changeRow');
    const changeEl = document.getElementById('saleChange');
    
    if (change > 0) {
        changeRow.style.display = 'flex';
        changeEl.textContent = formatCurrency(change);
    } else {
        changeRow.style.display = 'none';
    }
}

function calculateInstallments() {
    const count = parseInt(document.getElementById('installmentCount').value) || 2;
    const total = currentSaleTotal - currentDiscount;
    const installmentValue = total / count;
    const firstDate = new Date();
    
    let html = '';
    for (let i = 0; i < count; i++) {
        const date = new Date(firstDate);
        date.setMonth(date.getMonth() + i);
        html += `
            <div class="installment-row">
                <span>${i + 1}ª Parcela</span>
                <span>${formatCurrency(installmentValue)} - ${date.toLocaleDateString('pt-BR')}</span>
            </div>
        `;
    }
    document.getElementById('installmentDetails').innerHTML = html;
}

// ==========================================
// SALVAR DADOS
// ==========================================

function saveClient() {
    const id = document.getElementById('clientId').value;
    const name = document.getElementById('clientName').value.trim();
    
    if (!name) return alert('Digite o nome do cliente');

    if (id) {
        const client = db.clients.find(c => c.id === id);
        if (client) {
            client.name = name;
            client.phone = document.getElementById('clientPhone').value;
            client.limit = parseFloat(document.getElementById('clientLimit').value) || 0;
        }
    } else {
        const client = {
            id: Date.now().toString(),
            name: name,
            phone: document.getElementById('clientPhone').value,
            limit: parseFloat(document.getElementById('clientLimit').value) || 0,
            balance: 0,
            createdAt: new Date().toISOString()
        };
        db.clients.push(client);
    }

    saveData();
    closeModal('clientModal');
    
    document.getElementById('clientId').value = '';
    document.getElementById('clientName').value = '';
    document.getElementById('clientPhone').value = '';
    document.getElementById('clientLimit').value = '';
}

function saveProduct() {
    const name = document.getElementById('productName').value.trim();
    const cost = parseFloat(document.getElementById('productCost').value) || 0;
    const price = parseFloat(document.getElementById('productPrice').value) || 0;

    if (!name) return alert('Digite o nome do produto');
    if (price <= cost) return alert('O preço de venda deve ser maior que o custo');

    const product = {
        id: Date.now().toString(),
        name: name,
        cost: cost,
        price: price,
        stock: parseInt(document.getElementById('productStock').value) || 0,
        barcode: document.getElementById('productBarcode').value,
        category: document.getElementById('productCategory').value,
        createdAt: new Date().toISOString()
    };

    db.products.push(product);
    saveData();
    closeModal('productModal');
    
    document.getElementById('productName').value = '';
    document.getElementById('productCost').value = '';
    document.getElementById('productPrice').value = '';
    document.getElementById('productStock').value = '';
    document.getElementById('productBarcode').value = '';
    document.getElementById('productCategory').value = '';
}

function saveSale() {
    const clientId = document.getElementById('saleClient').value;
    const saleType = document.getElementById('saleType').value;
    const items = [];

    document.querySelectorAll('.product-select-item.selected').forEach(el => {
        const productId = el.dataset.id;
        const quantity = parseInt(el.querySelector('input[type="number"]').value) || 1;
        const product = db.products.find(p => p.id === productId);
        
        if (product) {
            items.push({
                productId: productId,
                quantity: quantity,
                price: product.price,
                cost: product.cost
            });
            product.stock = (product.stock || 0) - quantity;
        }
    });

    if (items.length === 0) return alert('Selecione pelo menos um produto');
    if ((saleType === 'fiado' || saleType === 'parcelado') && !clientId) return alert('Selecione um cliente');

    const subtotal = parseFloat(document.getElementById('saleTotal').dataset.subtotal) || 0;
    const costTotal = parseFloat(document.getElementById('saleTotal').dataset.cost) || 0;
    const total = subtotal - currentDiscount;

    const sale = {
        id: Date.now().toString(),
        type: 'sale',
        saleType: saleType,
        clientId: clientId,
        items: items,
        subtotal: subtotal,
        discount: currentDiscount,
        total: total,
        costTotal: costTotal,
        notes: document.getElementById('saleNotes').value,
        date: new Date().toISOString()
    };

    if (saleType === 'parcelado') {
        const count = parseInt(document.getElementById('installmentCount').value) || 2;
        sale.installments = count;
        sale.installmentValue = total / count;
    }

    if (clientId && (saleType === 'fiado' || saleType === 'parcelado')) {
        const client = db.clients.find(c => c.id === clientId);
        if (client) {
            client.balance = (client.balance || 0) + total;
        }
    }

    db.sales.push(sale);
    saveData();
    closeModal('saleModal');
    
    // Reset
    document.querySelectorAll('.product-select-item').forEach(el => {
        el.classList.remove('selected');
        el.querySelector('input[type="checkbox"]').checked = false;
    });
    document.getElementById('saleNotes').value = '';
    document.getElementById('discountValue').value = '';
    document.getElementById('discountPercent').value = '';
    document.getElementById('salePayment').value = '';
    document.getElementById('changeRow').style.display = 'none';
    currentDiscount = 0;
    currentSaleTotal = 0;
}

function savePayment() {
    const clientId = document.getElementById('paymentClient').value;
    const amount = parseFloat(document.getElementById('paymentAmount').value) || 0;
    const isPartial = document.getElementById('isPartialPayment').checked;
    
    if (!clientId || amount <= 0) return alert('Selecione o cliente e informe o valor');

    const client = db.clients.find(c => c.id === clientId);
    if (!client) return;

    const remaining = client.balance - amount;
    client.balance = Math.max(0, remaining);

    const payment = {
        id: Date.now().toString(),
        type: 'payment',
        clientId: clientId,
        amount: amount,
        isPartial: isPartial,
        remainingBalance: remaining > 0 ? remaining : 0,
        method: document.getElementById('paymentMethod').value,
        date: new Date().toISOString()
    };

    db.sales.push(payment);
    saveData();
    closeModal('paymentModal');
    
    document.getElementById('paymentAmount').value = '';
    document.getElementById('isPartialPayment').checked = false;
    document.getElementById('remainingSection').style.display = 'none';
}

function saveExpense() {
    const amount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    if (amount <= 0) return alert('Informe o valor da despesa');

    const expense = {
        id: Date.now().toString(),
        type: 'expense',
        description: document.getElementById('expenseDesc').value || 'Despesa',
        amount: amount,
        category: document.getElementById('expenseCategory').value,
        date: document.getElementById('expenseDate').value || new Date().toISOString()
    };

    db.expenses.push(expense);
    db.sales.push(expense);
    saveData();
    closeModal('expenseModal');
    
    document.getElementById('expenseDesc').value = '';
    document.getElementById('expenseAmount').value = '';
}

// ==========================================
// PAGAMENTO E TRANSFERÊNCIA
// ==========================================

function togglePartialPayment() {
    const isPartial = document.getElementById('isPartialPayment').checked;
    document.getElementById('remainingSection').style.display = isPartial ? 'block' : 'none';
    if (isPartial) calculateRemaining();
}

function updatePaymentAmount() {
    const clientId = document.getElementById('paymentClient').value;
    const client = db.clients.find(c => c.id === clientId);
    const amount = client ? client.balance : 0;
    document.getElementById('totalDebtDisplay').value = formatCurrency(amount);
    document.getElementById('paymentAmount').value = amount.toFixed(2);
    calculateRemaining();
}

function calculateRemaining() {
    const clientId = document.getElementById('paymentClient').value;
    const client = db.clients.find(c => c.id === clientId);
    if (!client) return;
    
    const received = parseFloat(document.getElementById('paymentAmount').value) || 0;
    const remaining = Math.max(0, client.balance - received);
    document.getElementById('remainingAmount').textContent = formatCurrency(remaining);
}

function updateTransferAmount() {
    const clientId = document.getElementById('transferFrom').value;
    const client = db.clients.find(c => c.id === clientId);
    if (client) {
        document.getElementById('transferAmount').value = client.balance.toFixed(2);
    }
}

function executeTransfer() {
    const fromId = document.getElementById('transferFrom').value;
    const toId = document.getElementById('transferTo').value;
    const amount = parseFloat(document.getElementById('transferAmount').value) || 0;
    
    if (!fromId || !toId || amount <= 0) {
        alert('Preencha todos os campos');
        return;
    }
    
    if (fromId === toId) {
        alert('Clientes devem ser diferentes');
        return;
    }
    
    const fromClient = db.clients.find(c => c.id === fromId);
    const toClient = db.clients.find(c => c.id === toId);
    
    if (!fromClient || !toClient) return;
    
    if (amount > fromClient.balance) {
        alert('Valor maior que a dívida do cliente origem');
        return;
    }
    
    fromClient.balance -= amount;
    toClient.balance = (toClient.balance || 0) + amount;
    
    const now = new Date().toISOString();
    db.sales.push({
        id: Date.now().toString(),
        type: 'transfer',
        fromClientId: fromId,
        toClientId: toId,
        amount: amount,
        date: now,
        notes: `Transferência de ${fromClient.name} para ${toClient.name}`
    });
    
    saveData();
    closeModal('transferModal');
    alert(`✅ Transferido ${formatCurrency(amount)} de ${fromClient.name} para ${toClient.name}`);
}

// ==========================================
// UTILITÁRIOS
// ==========================================

function updateSaleClientSelect() {
    const select = document.getElementById('saleClient');
    select.innerHTML = '<option value="">Selecione um cliente...</option>' +
        db.clients.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

function showTab(tab, btn) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(tab).classList.add('active');
}

function exportData() {
    const dataStr = JSON.stringify(db, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fiadobot_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
}

function importData(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (confirm(`Importar ${data.clients?.length || 0} clientes, ${data.products?.length || 0} produtos e ${data.sales?.length || 0} transações?`)) {
                db = data;
                saveData();
                alert('✅ Dados importados com sucesso!');
            }
        } catch (err) {
            alert('❌ Erro ao importar arquivo');
        }
    };
    reader.readAsText(file);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value || 0);
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('pt-BR');
}

function formatMonth(monthStr) {
    const [year, month] = monthStr.split('-');
    return new Date(year, month - 1).toLocaleDateString('pt-BR', {month: 'long', year: 'numeric'});
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================

window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}

// ==========================================
// CONFIGURAÇÕES E UTILITÁRIOS
// ==========================================

function openSettingsModal() {
    document.getElementById('settingsModal').classList.add('active');
}

function clearAllData() {
    if (confirm('⚠️ ATENÇÃO!\n\nIsso apagará TODOS os dados permanentemente:\n• Todos os clientes\n• Todos os produtos\n• Todo o histórico\n\nEsta ação não pode ser desfeita!\n\nDeseja continuar?')) {
        if (confirm('Tem certeza absoluta? Digite "SIM" para confirmar.')) {
            db = {
                clients: [],
                products: [],
                sales: [],
                expenses: [],
                version: '2.1'
            };
            saveData();
            alert('✅ Todos os dados foram apagados.');
            closeModal('settingsModal');
        }
    }
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}
// ==========================================
// MODAL DE CONFIGURAÇÕES
// ==========================================

function openSettingsModal() {
    document.getElementById('settingsModal').classList.add('active');
}

// ==========================================
// EXPORTAR/IMPORTAR JSON (AGORA SÓ NO MODAL)
// ==========================================

function exportData() {
    const dataStr = JSON.stringify(db, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fiadobot_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    // Feedback visual
    showToast('✅ Backup exportado com sucesso!');
}

function importData(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            // Validar estrutura básica
            if (!data.clients || !data.products || !data.sales) {
                throw new Error('Arquivo inválido');
            }
            
            if (confirm(`📤 Importar dados?\n\n• ${data.clients.length} clientes\n• ${data.products.length} produtos\n• ${data.sales.length} transações\n\nIsso substituirá todos os dados atuais.`)) {
                db = {
                    clients: data.clients || [],
                    products: data.products || [],
                    sales: data.sales || [],
                    expenses: data.expenses || [],
                    version: data.version || '2.1'
                };
                saveData();
                showToast('✅ Dados importados com sucesso!');
                closeModal('settingsModal');
            }
        } catch (err) {
            alert('❌ Erro ao importar arquivo.\n\nVerifique se é um arquivo JSON válido do FiadoBot.');
        }
        input.value = ''; // Reset input
    };
    reader.readAsText(file);
}

// ==========================================
// LIMPAR TODOS OS DADOS
// ==========================================

function clearAllData() {
    const confirm1 = confirm('⚠️ ATENÇÃO!\n\nIsso apagará PERMANENTEMENTE:\n• Todos os clientes\n• Todos os produtos\n• Todo o histórico de vendas\n• Todas as transações\n\nEsta ação não pode ser desfeita!\n\nDeseja continuar?');
    
    if (confirm1) {
        const confirm2 = prompt('Digite "APAGAR" para confirmar:');
        if (confirm2 === 'APAGAR') {
            db = {
                clients: [],
                products: [],
                sales: [],
                expenses: [],
                version: '2.1'
            };
            saveData();
            showToast('🗑️ Todos os dados foram apagados');
            closeModal('settingsModal');
        } else {
            showToast('❌ Ação cancelada');
        }
    }
}

// ==========================================
// FECHAR MODAIS
// ==========================================

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

// Fechar ao clicar fora
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.classList.remove('active');
    }
}

// ==========================================
// TOAST NOTIFICATION (OPCIONAL)
// ==========================================

function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--text-primary);
        color: var(--bg-secondary);
        padding: 16px 24px;
        border-radius: 12px;
        font-weight: 600;
        box-shadow: var(--shadow-large);
        z-index: 3000;
        animation: slideUp 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideDown 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Iniciar
loadData();

