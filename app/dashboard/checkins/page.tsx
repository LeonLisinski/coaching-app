'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ClientsCheckinTab from '@/app/dashboard/checkins/tabs/clients-tab'
import ParametersTab from '@/app/dashboard/checkins/tabs/parameters-tab'

export default function CheckinsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Checkini</h1>
        <p className="text-gray-500">Praćenje napretka klijenata</p>
      </div>

      <Tabs defaultValue="clients">
        <TabsList>
          <TabsTrigger value="clients">Klijenti</TabsTrigger>
          <TabsTrigger value="parameters">Parametri</TabsTrigger>
        </TabsList>
        <TabsContent value="clients" className="mt-6">
          <ClientsCheckinTab />
        </TabsContent>
        <TabsContent value="parameters" className="mt-6">
          <ParametersTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}