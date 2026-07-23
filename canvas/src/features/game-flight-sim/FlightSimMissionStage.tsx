import React from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { type Group, type Mesh } from 'three'
import { XrProceduralVehicleGeometry } from '@/features/three/XrProceduralVehicleGeometry'
import {
  claimThreeViewportInputOwnership,
  releaseThreeViewportInputOwnership,
} from '@/features/three/threeViewportInputOwnership'
import { readMotionControlSnapshot } from '@/features/three/motionControlRuntime'
import {
  isMotionControlPoseTracked,
  motionControlPoseToControllerInput,
} from '@/features/three/motionControlPose'
import { readXrNativeControllerCamera } from '@/features/three/xrNativeControllerCameraRuntime'
import { FLIGHT_SIM_AIRCRAFT_ASSET_SPEC } from './assetSpec/flightSimAssetSpec'
import {
  installFlightSimDesktopInput,
  mergeFlightSimInputs,
  readFlightSimTouchInput,
  readStandardFlightSimGamepad,
  setFlightSimTouchInput,
  type FlightSimInputBinding,
} from './flightSimInput'
import { flightSimInputFromMotionController } from './flightSimMotionControlAdapter'
import {
  advanceFlightSimByFixedStep,
  isFlightSimHydrationPending,
  readFlightSimSnapshot,
  readFlightSimSpatialProfile,
  setFlightSimInput,
  stopFlightSim,
  subscribeFlightSimSnapshot,
} from './flightSimRuntime'
import { FLIGHT_SIM_FIXED_STEP_SECONDS, FLIGHT_SIM_NEUTRAL_INPUT } from './flightSimModel'
import { createFlightSimSimulationClock } from './flightSimSimulationClock'

const INPUT_OWNER_ID = 'flight-sim:aircraft'
const CLOCK_INTERVAL_MS = FLIGHT_SIM_FIXED_STEP_SECONDS * 1000

export function FlightSimMissionStage({ coordinateScale = 1 }: {
  coordinateScale?: number
}) {
  const { gl } = useThree()
  const actorRef = React.useRef<Group | null>(null)
  const waypointRefs = React.useRef(new Map<string, Mesh>())
  const landingPadRef = React.useRef<Mesh | null>(null)
  const snapshotRef = React.useRef(readFlightSimSnapshot())
  const desktopInputRef = React.useRef(FLIGHT_SIM_NEUTRAL_INPUT)
  const desktopBindingRef = React.useRef<FlightSimInputBinding | null>(null)
  const inputClaimedRef = React.useRef(false)
  const profile = React.useMemo(() => readFlightSimSpatialProfile(), [])

  React.useEffect(() => subscribeFlightSimSnapshot(() => {
    snapshotRef.current = readFlightSimSnapshot()
  }), [])

  React.useEffect(() => {
    const canvas = gl.domElement
    const claimed = claimThreeViewportInputOwnership(INPUT_OWNER_ID, {
      blocksProgrammaticCamera: false,
    })
    inputClaimedRef.current = claimed
    canvas.dataset.kgFlightSimInputOwner = claimed ? INPUT_OWNER_ID : 'blocked'
    canvas.dataset.kgFlightSimSpatialProfile = profile.id
    const desktop = claimed ? installFlightSimDesktopInput(canvas, {
      onInput: value => {
        desktopInputRef.current = value
      },
      onPause: () => {
        setFlightSimTouchInput({})
        stopFlightSim()
      },
      shouldPauseOnPointerRelease: () => readXrNativeControllerCamera().mode === 'fixed-follow',
      shouldRequestPointerLock: () => readXrNativeControllerCamera().mode === 'fixed-follow',
    }) : null
    desktopBindingRef.current = desktop
    return () => {
      inputClaimedRef.current = false
      if (desktopBindingRef.current === desktop) desktopBindingRef.current = null
      desktop?.dispose()
      releaseThreeViewportInputOwnership(INPUT_OWNER_ID)
      delete canvas.dataset.kgFlightSimInputOwner
      delete canvas.dataset.kgFlightSimSpatialProfile
      delete canvas.dataset.kgFlightSimFirstFrame
    }
  }, [gl, profile.id])

  React.useEffect(() => {
    const clock = createFlightSimSimulationClock({
      minimumStepIntervalMs: CLOCK_INTERVAL_MS,
      runStep: async () => {
        const pose = readMotionControlSnapshot().pose
        const motionInput = flightSimInputFromMotionController(
          motionControlPoseToControllerInput(pose),
          isMotionControlPoseTracked(pose),
        )
        const input = mergeFlightSimInputs([
          desktopBindingRef.current?.consumeInput() ?? desktopInputRef.current,
          readFlightSimTouchInput(),
          readStandardFlightSimGamepad(),
          motionInput,
        ])
        setFlightSimInput(input)
        if (readFlightSimSnapshot().phase === 'flying') await advanceFlightSimByFixedStep()
      },
      onStepError: () => {
        stopFlightSim()
      },
    })
    const timer = window.setInterval(clock.requestStep, CLOCK_INTERVAL_MS)
    return () => {
      window.clearInterval(timer)
      clock.dispose()
      setFlightSimInput(FLIGHT_SIM_NEUTRAL_INPUT)
    }
  }, [])

  useFrame(() => {
    const snapshot = readFlightSimSnapshot()
    snapshotRef.current = snapshot
    const actor = actorRef.current
    if (actor) {
      actor.position.set(...snapshot.aircraft.position)
      actor.rotation.set(
        snapshot.aircraft.pitch,
        snapshot.aircraft.yaw,
        -snapshot.aircraft.roll,
        'YXZ',
      )
      actor.visible = snapshot.active
    }
    for (let index = 0; index < profile.waypoints.length; index += 1) {
      const waypoint = profile.waypoints[index]!
      const mesh = waypointRefs.current.get(waypoint.id)
      if (mesh) mesh.visible = snapshot.active && index >= snapshot.waypointIndex
    }
    if (landingPadRef.current) {
      landingPadRef.current.visible = snapshot.active
        && snapshot.waypointIndex >= profile.waypoints.length
    }
    const playable = (snapshot.phase === 'ready' || snapshot.phase === 'flying')
      && snapshot.runId > 0
      && !isFlightSimHydrationPending()
    if (snapshot.active && playable && inputClaimedRef.current && !snapshot.runtimeError) {
      gl.domElement.dataset.kgFlightSimFirstFrame = '1'
    } else {
      delete gl.domElement.dataset.kgFlightSimFirstFrame
    }
  })

  return (
    <group
      name="kg_flight_sim_mission"
      scale={coordinateScale}
      userData={{ actorOnly: true, coordinateScale, spatialProfile: profile.id }}
    >
      <group
        ref={actorRef}
        name="kg_flight_sim_aircraft"
        position={snapshotRef.current.aircraft.position}
        userData={{
          assetId: FLIGHT_SIM_AIRCRAFT_ASSET_SPEC.id,
          representation: FLIGHT_SIM_AIRCRAFT_ASSET_SPEC.representation,
        }}
      >
        <group rotation={[-Math.PI / 2, 0, 0]}>
          <XrProceduralVehicleGeometry
            kind="airplane"
            color={FLIGHT_SIM_AIRCRAFT_ASSET_SPEC.defaultColor}
            size={FLIGHT_SIM_AIRCRAFT_ASSET_SPEC.dimensionsMeters}
          />
        </group>
      </group>
      {profile.waypoints.map((waypoint, index) => (
        <mesh
          key={waypoint.id}
          ref={mesh => {
            if (mesh) waypointRefs.current.set(waypoint.id, mesh)
            else waypointRefs.current.delete(waypoint.id)
          }}
          name={`kg_${waypoint.id.replaceAll(':', '_')}`}
          position={waypoint.position}
          rotation={[Math.PI / 2, 0, 0]}
          userData={{ waypointId: waypoint.id, waypointIndex: index }}
        >
          <torusGeometry args={[waypoint.radiusMeters, 0.14, 10, 32]} />
          <meshStandardMaterial
            color={index === snapshotRef.current.waypointIndex ? '#22d3ee' : '#f8fafc'}
            emissive="#0891b2"
            emissiveIntensity={0.42}
            transparent
            opacity={0.82}
          />
        </mesh>
      ))}
      <mesh
        ref={landingPadRef}
        name="kg_flight_sim_landing_pad"
        position={profile.landingPad.position}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={snapshotRef.current.waypointIndex >= profile.waypoints.length}
        userData={{
          landingPadId: profile.landingPad.id,
          captureRadiusMeters: profile.landingPad.radiusMeters,
        }}
      >
        <ringGeometry args={[2.4, 3.2, 40]} />
        <meshStandardMaterial
          color="#facc15"
          emissive="#ca8a04"
          emissiveIntensity={0.5}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  )
}
