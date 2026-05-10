import { create, useStore } from 'zustand/react'
import { createStore } from 'zustand/vanilla'

export { create, createStore, useStore }

const zustandDefault: typeof create = create

export default zustandDefault
