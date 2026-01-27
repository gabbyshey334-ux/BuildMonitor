import { queryClient } from "./queryClient";

// This will be used for showing notifications
let showNotification: ((options: { title: string; description: string; variant?: "default" | "destructive" }) => void) | null = null;

export function setNotificationHandler(handler: typeof showNotification) {
  showNotification = handler;
}

function getCurrentUserRole(): string | null {
  // Try to get user role from localStorage or session
  try {
    const userData = sessionStorage.getItem('user-data');
    if (userData) {
      const user = JSON.parse(userData);
      return user.role;
    }
  } catch {
    // Fallback - we'll determine from context
  }
  return null;
}

function getCurrentUserId(): string | null {
  // Try to get current user ID to avoid self-notifications
  try {
    const userData = sessionStorage.getItem('user-data');
    if (userData) {
      const user = JSON.parse(userData);
      return user.id;
    }
  } catch {
    // Fallback
  }
  return null;
}

class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected - Real-time updates enabled');
        this.reconnectAttempts = 0;
        this.isConnecting = false;
      };
      
      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnecting = false;
        this.scheduleReconnect();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private handleMessage(message: any) {
    console.log('Received real-time update:', message);
    
    switch (message.type) {
      case 'CONNECTED':
        console.log('Real-time updates enabled');
        break;
        
      case 'PROJECT_CREATED':
        // Invalidate projects list
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
        break;
        
      case 'TASK_CREATED':
      case 'TASK_UPDATED':
      case 'TASK_DELETED':
        // Invalidate tasks for the project and project analytics
        queryClient.invalidateQueries({ queryKey: ['/api/projects', message.projectId, 'tasks'] });
        queryClient.invalidateQueries({ queryKey: ['/api/projects', message.projectId, 'analytics'] });
        break;
        
      case 'LEDGER_CREATED':
        // Invalidate financial data
        queryClient.invalidateQueries({ queryKey: ['/api/projects', message.projectId, 'daily-ledgers'] });
        queryClient.invalidateQueries({ queryKey: ['/api/projects', message.projectId, 'analytics'] });
        queryClient.invalidateQueries({ queryKey: ['/api/projects', message.projectId, 'opening-balance'] });
        break;
        
      case 'CASH_DEPOSIT_CREATED':
        // Invalidate cash deposits and analytics
        queryClient.invalidateQueries({ queryKey: ['/api/projects', message.projectId, 'cash-deposits'] });
        queryClient.invalidateQueries({ queryKey: ['/api/projects', message.projectId, 'analytics'] });
        // Invalidate opening balance for all dates to ensure cash balance updates
        queryClient.invalidateQueries({ 
          queryKey: ['/api/projects', message.projectId, 'opening-balance'],
          exact: false 
        });
        
        // Show notification to managers when owner sends cash
        const currentUserId = getCurrentUserId();
        console.log('Cash deposit notification check:', {
          hasNotificationHandler: !!showNotification,
          messageUserId: message.userId,
          currentUserId: currentUserId,
          shouldShowNotification: showNotification && message.userId !== currentUserId
        });
        
        if (showNotification && message.userId !== currentUserId) {
          const amount = parseFloat(message.data.amount).toLocaleString();
          console.log('Showing cash deposit notification for amount:', amount);
          showNotification({
            title: "💰 Cash Received",
            description: `UGX ${amount} has been deposited to your project by the owner`,
          });
        }
        break;
        
      case 'PURCHASE_CREATED':
        // Invalidate supplier purchases and analytics
        queryClient.invalidateQueries({ queryKey: ['/api/supplier-purchases'] });
        queryClient.invalidateQueries({ queryKey: ['/api/supplier-purchases', message.projectId] });
        queryClient.invalidateQueries({ queryKey: ['/api/projects', message.projectId, 'analytics'] });
        break;
        
      case 'MILESTONE_CREATED':
      case 'MILESTONE_UPDATED':
        // Invalidate milestones for the project
        queryClient.invalidateQueries({ queryKey: ['/api/projects', message.projectId, 'milestones'] });
        break;
        
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const websocketManager = new WebSocketManager();