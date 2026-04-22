import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

type AdminState = {
  /** True uniquement après vérification (Firebase Auth + doc admins/{uid}). */
  isAdminVerified: boolean
  /** Mode UI : masquer les éléments admin quand on est admin. */
  viewAsPlayer: boolean
}

const initialState: AdminState = {
  isAdminVerified: false,
  viewAsPlayer: false,
}

export const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    setAdminVerified(state, action: PayloadAction<boolean>) {
      state.isAdminVerified = action.payload
      if (!action.payload) state.viewAsPlayer = false
    },
    setViewAsPlayer(state, action: PayloadAction<boolean>) {
      if (!state.isAdminVerified) {
        state.viewAsPlayer = false
        return
      }
      state.viewAsPlayer = action.payload
    },
  },
})

export const { setAdminVerified, setViewAsPlayer } = adminSlice.actions
