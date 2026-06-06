import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AppStateService } from '../app-state.service';
import { LeadService } from '../lead.service';
import { NotificationService } from '../notification.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, OnDestroy {
  leads: any[] = [];
  filteredLeads: any[] = [];
  
  // Stats
  totalLeads = 0;
  newLeads = 0;
  convertedLeads = 0;
  rejectedLeads = 0;

  private eventSource: EventSource | null = null;

  // Filters
  searchTerm = '';
  selectedStatus = '';
  statuses: string[] = ['New', 'Contacted', 'Qualified', 'Rejected', 'Converted'];

  // Pagination
  currentPage = 1;
  pageSize = 10;
  get totalPages() { return Math.ceil(this.filteredLeads.length / this.pageSize); }
  get paginatedLeads() { 
    return this.filteredLeads.slice((this.currentPage - 1) * this.pageSize, this.currentPage * this.pageSize); 
  }

  isLoading = true;
  
  showDeleteModal = false;
  showLeadModal = false;
  isEditing = false;
  leadToDelete: any = null;

    leadForm = {
    id: null,
    name: '',
    email: '',
    company: '',
    linkedin_id: '',
    status: 'New',
    source: '',
    department: '',
    notes: ''
  };

  constructor(
    private leadService: LeadService, 
    private router: Router,
    private notificationService: NotificationService,
    private appStateService: AppStateService
  ) {}

  ngOnInit(): void {
    if (!localStorage.getItem('auth')) {
      this.router.navigate(['/login']);
      return;
    }

    if (this.appStateService.hasComponentState('DashboardComponent')) {
      const state = this.appStateService.getComponentState('DashboardComponent');
      this.searchTerm = state.searchTerm;
      this.selectedStatus = state.selectedStatus;
      this.currentPage = state.currentPage;
    }

    this.fetchLeads();
    this.setupSSE();
  }

  setupSSE() {
    this.eventSource = new EventSource('http://localhost:3000/api/leads/stream');
    this.eventSource.onmessage = (event) => {
      const parsedData = JSON.parse(event.data);
      if (parsedData.type === 'NEW_LEAD') {
        this.leads.unshift(parsedData.data);
        this.applyFilters();
        this.calculateStats();
      } else if (parsedData.type === 'LEAD_UPDATED') {
        const index = this.leads.findIndex(l => l.id === parsedData.data.id);
        if (index !== -1) {
          this.leads[index] = parsedData.data;
          this.applyFilters();
          this.calculateStats();
        }
      } else if (parsedData.type === 'LEAD_DELETED') {
        this.leads = this.leads.filter(l => l.id !== parsedData.data.id);
        this.applyFilters();
        this.calculateStats();
      }
    };
  }

  ngOnDestroy(): void {
    this.appStateService.setComponentState('DashboardComponent', {
      searchTerm: this.searchTerm,
      selectedStatus: this.selectedStatus,
      currentPage: this.currentPage
    });
    
    if (this.eventSource) {
      this.eventSource.close();
    }
  }

  fetchLeads() {
    this.isLoading = true;
    this.leadService.getLeads().subscribe({
      next: (data) => {
        this.leads = data;
        this.filteredLeads = data;
        this.calculateStats();
        this.isLoading = false;
      },
      error: (err) => {
        this.notificationService.showError('Failed to load leads');
        this.isLoading = false;
      }
    });
  }

  calculateStats() {
    this.totalLeads = this.leads.length;
    this.newLeads = this.leads.filter(l => l.status === 'New').length;
    this.convertedLeads = this.leads.filter(l => l.status === 'Converted').length;
    this.rejectedLeads = this.leads.filter(l => l.status === 'Rejected').length;
  }

  applyFilters() {
    this.filteredLeads = this.leads.filter(lead => {
      const searchStr = this.searchTerm.toLowerCase();
      const matchesSearch = lead.name.toLowerCase().includes(searchStr) || 
                            lead.email.toLowerCase().includes(searchStr) ||
                            (lead.company && lead.company.toLowerCase().includes(searchStr));
      const matchesStatus = this.selectedStatus ? lead.status === this.selectedStatus : true;
      return matchesSearch && matchesStatus;
    });
    this.currentPage = 1; // reset to first page on filter change
  }

  nextPage() {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  prevPage() {
    if (this.currentPage > 1) this.currentPage--;
  }

  confirmDelete(lead: any) {
    this.leadToDelete = lead;
    this.showDeleteModal = true;
  }

  cancelDelete() {
    this.showDeleteModal = false;
    this.leadToDelete = null;
  }

  executeDelete() {
    if (!this.leadToDelete) return;

    this.leadService.deleteLead(this.leadToDelete.id).subscribe({
      next: (res) => {
        if (res.success) {
          this.showDeleteModal = false;
          this.leadToDelete = null;
          this.notificationService.showSuccess('Lead deleted successfully');
          this.fetchLeads();
        }
      },
      error: (err) => {
        this.notificationService.showError(err.error?.message || 'Failed to delete lead');
        this.showDeleteModal = false;
      }
    });
  }

  openAddModal() {
    this.isEditing = false;
    this.leadForm = {
      id: null,
      name: '',
      email: '',
      company: '',
      linkedin_id: '',
      status: 'New',
      source: '',
      department: '',
      notes: ''
    };
    this.showLeadModal = true;
  }

  openEditModal(lead: any) {
    this.isEditing = true;
    this.leadForm = { ...lead };
    this.showLeadModal = true;
  }

  closeLeadModal() {
    this.showLeadModal = false;
  }

  saveLead() {
    if (!this.leadForm.name || !this.leadForm.email || !this.leadForm.source) {
      this.notificationService.showError('Please fill in required fields');
      return;
    }

    if (this.isEditing) {
      this.leadService.updateLead(this.leadForm.id!, this.leadForm).subscribe({
        next: (res) => {
          this.notificationService.showSuccess('Lead updated successfully');
          this.showLeadModal = false;
          this.fetchLeads();
        },
        error: (err) => {
          this.notificationService.showError('Failed to update lead');
        }
      });
    } else {
      this.leadService.addLead(this.leadForm).subscribe({
        next: (res) => {
          this.notificationService.showSuccess('Lead added successfully');
          this.showLeadModal = false;
          this.fetchLeads();
        },
        error: (err) => {
          this.notificationService.showError('Failed to add lead');
        }
      });
    }
  }
}
