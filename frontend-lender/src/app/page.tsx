// app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { SuiClient, getFullnodeUrl } from '@mysten/sui.js/client';
import { X, User, TrendingUp, TrendingDown, Shield, AlertTriangle } from 'lucide-react';
import { normalizeSuiAddress } from '@mysten/sui.js/utils';

// Interfaces for data structure consistency
interface Person {
  id: string;
  name: string;
  email: string;
  creditScore: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  personality: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  riskFactors: {
    communicationStyle: number;
    emotionalIntelligence: number;
    financialResponsibility: number;
    relationshipStability: number;
  };
  analysisDetails: {
    messagesAnalyzed: number;
    processingTime: string;
    analysisId: string;
    confidence: number;
  };
}

interface Contract {
  id: string;
  name: string;
  address: string;
  type: 'Credit Assessment' | 'Risk Evaluation' | 'Personality Analysis' | 'Loan Management';
  deployedAt: string;
  status: 'Active' | 'Pending' | 'Inactive';
  totalLoans?: string;
  totalVolume?: string;
  transactionCount: number;
  lastActivity: string;
}

// Define the expected structure of your contract's fields
interface LoanRegistryFields {
  total_loans: string;
  total_volume: string;
  [key: string]: any; // For other fields you might have
}

// Mock data remains for the 'People' tab
const mockPeople: Person[] = [
  {
    id: '1',
    name: 'Alice Johnson',
    email: 'alice.johnson@email.com',
    creditScore: 750,
    riskLevel: 'Low',
    personality: {
      openness: 72,
      conscientiousness: 85,
      extraversion: 45,
      agreeableness: 78,
      neuroticism: 25
    },
    riskFactors: {
      communicationStyle: 15,
      emotionalIntelligence: 82,
      financialResponsibility: 5,
      relationshipStability: 12
    },
    analysisDetails: {
      messagesAnalyzed: 156,
      processingTime: '2.3s',
      analysisId: 'A1B2C3D4...',
      confidence: 89
    }
  },
  {
    id: '2',
    name: 'Bob Smith',
    email: 'bob.smith@email.com',
    creditScore: 620,
    riskLevel: 'Medium',
    personality: {
      openness: 51,
      conscientiousness: 72,
      extraversion: 59,
      agreeableness: 76,
      neuroticism: 33
    },
    riskFactors: {
      communicationStyle: 42,
      emotionalIntelligence: 66,
      financialResponsibility: 35,
      relationshipStability: 28
    },
    analysisDetails: {
      messagesAnalyzed: 89,
      processingTime: '1.8s',
      analysisId: 'E5F6G7H8...',
      confidence: 76
    }
  },
  {
    id: '3',
    name: 'Carol Davis',
    email: 'carol.davis@email.com',
    creditScore: 480,
    riskLevel: 'High',
    personality: {
      openness: 38,
      conscientiousness: 45,
      extraversion: 72,
      agreeableness: 52,
      neuroticism: 68
    },
    riskFactors: {
      communicationStyle: 78,
      emotionalIntelligence: 34,
      financialResponsibility: 82,
      relationshipStability: 65
    },
    analysisDetails: {
      messagesAnalyzed: 203,
      processingTime: '3.1s',
      analysisId: 'I9J0K1L2...',
      confidence: 71
    }
  }
];

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'people' | 'contracts'>('contracts');
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  // Constants for your deployed contract
  const LOAN_REGISTRY_OBJECT_ID = '0xb4201bdf21732384a5e621bacd9cb9a0c0f658031937555026f85daf30ab2e8c';

  useEffect(() => {
    const fetchLiveContract = async () => {
      setLoading(true);
      try {
        const client = new SuiClient({ url: getFullnodeUrl('testnet') });
        const obj = await client.getObject({
          id: LOAN_REGISTRY_OBJECT_ID,
          options: { showContent: true, showType: true },
        });

        if (obj.data && obj.data.content?.dataType === 'moveObject') {
          // Cast the fields to your expected structure
          const fields = obj.data.content.fields as LoanRegistryFields;
          
          const liveContract: Contract = {
            id: obj.data.objectId,
            name: 'LoanRegistry',
            address: obj.data.objectId,
            type: 'Loan Management',
            status: 'Active',
            totalLoans: fields.total_loans || '0',
            totalVolume: fields.total_volume || '0',
            transactionCount: parseInt(fields.total_loans || '0'),
            deployedAt: 'N/A', // Can be fetched from an external API or hardcoded
            lastActivity: 'N/A', // Can be fetched by querying latest transactions
          };
          setContracts([liveContract]);
        }
      } catch (error) {
        console.error('Failed to fetch live contract data:', error);
        setContracts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLiveContract();
  }, []);

  const getCreditScoreColor = (score: number) => {
    if (score >= 700) return 'text-green-500';
    if (score >= 600) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRiskLevelColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'High': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-100 text-green-800';
      case 'Pending': return 'bg-yellow-100 text-yellow-800';
      case 'Inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Credit Score Evaluation Platform
        </h1>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-8 max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('people')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'people'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            People & Scores
          </button>
          <button
            onClick={() => setActiveTab('contracts')}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'contracts'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Blockchain Contracts
          </button>
        </div>

        {/* People Tab */}
        {activeTab === 'people' && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {mockPeople.map((person) => (
              <div
                key={person.id}
                className="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition-shadow border border-gray-100"
              >
                <div className="flex items-center mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {person.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div className="ml-3">
                    <h3 className="font-semibold text-gray-900">{person.name}</h3>
                    <p className="text-gray-600 text-sm">{person.email}</p>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-gray-600">Credit Score</span>
                    <span className={`font-bold text-xl ${getCreditScoreColor(person.creditScore)}`}>
                      {person.creditScore}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-gray-600">Risk Level</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskLevelColor(person.riskLevel)}`}>
                      {person.riskLevel}
                    </span>
                  </div>

                  <div className="flex items-center text-sm text-gray-500">
                    <User size={14} className="mr-1" />
                    {person.analysisDetails.messagesAnalyzed} messages analyzed
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Confidence</span>
                    <span className="font-medium">{person.analysisDetails.confidence}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Contracts Tab */}
        {activeTab === 'contracts' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center text-gray-500">Loading contracts from Sui network...</div>
            ) : contracts.length === 0 ? (
              <div className="text-center text-gray-500">No contracts found.</div>
            ) : (
              contracts.map((contract) => (
                <div
                  key={contract.id}
                  className="bg-white rounded-xl shadow-lg p-6 border border-gray-100"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center text-white text-lg font-bold">
                        {contract.name[0]}
                      </div>
                      <div className="ml-3">
                        <h3 className="font-semibold text-gray-900">{contract.name}</h3>
                        <p className="text-gray-600 text-sm">{contract.type}</p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(contract.status)}`}>
                      {contract.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <span className="text-gray-600 text-sm block">Contract Address</span>
                      <span className="font-mono text-sm text-gray-900">
                        {normalizeSuiAddress(contract.address)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600 text-sm block">Total Loans</span>
                      <span className="text-sm text-gray-900 font-medium">{contract.totalLoans}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 text-sm block">Total Volume</span>
                      <span className="text-sm text-gray-900 font-medium">{contract.totalVolume}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center text-sm text-gray-500">
                      <Shield size={14} className="mr-1" />
                      Smart Contract on Sui Network
                    </div>
                    <div className="flex items-center space-x-2">
                      <TrendingUp size={16} className="text-green-500" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions (for formatting dates, etc.) from original code
// This is not necessary for this example but can be added back if needed
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};