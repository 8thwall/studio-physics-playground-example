import * as ecs from '@8thwall/ecs'
// Import camera data from both controllers
// The camera will update the appropriate one based on controllerType
import {ballCameraData} from './ball-controller'
import {rocketCameraData} from './rocket-controller'

const customOrbitCam = ecs.registerComponent({
  name: 'customOrbitCam',
  schema: {
    target: ecs.eid,                // Entity to follow
    distance: ecs.f32,              // Distance from target
    height: ecs.f32,                // Height offset above target
    rotationSpeed: ecs.f32,         // Camera rotation speed
    followSpeed: ecs.f32,           // How fast camera follows target
    autoOrientSpeed: ecs.f32,       // How fast camera auto-orients to ball direction
    autoOrientStrength: ecs.f32,    // Strength of auto-orientation (0-1)
    minVelocityThreshold: ecs.f32,  // Minimum velocity to trigger auto-orient
    controllerType: ecs.string,     // Type of controller: 'ball' or 'rocket'
  },
  schemaDefaults: {
    distance: 5.0,
    height: 2.0,
    rotationSpeed: 0.5,            // Smoother manual rotation
    followSpeed: 0.1,              // Smoother camera following
    autoOrientSpeed: 0.04,         // Moderate auto-orientation speed
    autoOrientStrength: 0.04,      // 100% auto-orient based on movement
    minVelocityThreshold: 0.003,   // Low threshold to detect movement
    controllerType: 'ball',        // Default to ball controller
  },
  data: {
    azimuthAngle: ecs.f32,         // Horizontal rotation around target
    polarAngle: ecs.f32,           // Vertical angle (elevation)
    targetAzimuthAngle: ecs.f32,   // Target azimuth based on ball movement
    targetPolarAngle: ecs.f32,     // Target polar angle for snap-back
    lastTargetPositionX: ecs.f32,  // Previous target X position for velocity calculation
    lastTargetPositionY: ecs.f32,  // Previous target Y position for velocity calculation
    lastTargetPositionZ: ecs.f32,  // Previous target Z position for velocity calculation
    velocityX: ecs.f32,            // Current velocity X component
    velocityZ: ecs.f32,            // Current velocity Z component
    isDragging: ecs.boolean,       // Tracks if user is actively dragging to control camera
    activeController: ecs.string,  // Track which controller is active
  },
  stateMachine: ({world, eid, dataAttribute}) => {
    // Handle gesture start (drag start)
    const handleGestureStart = (e: any) => {
      const data = dataAttribute.cursor(eid)
      data.isDragging = true
    }

    // Handle gesture move (dragging)
    const handleGestureMove = (e: any) => {
      const gestureMoveEvent = e.data as ecs.GestureMoveEvent
      const schema = customOrbitCam.get(world, eid)
      const data = dataAttribute.cursor(eid)

      if (gestureMoveEvent.touchCount === 1) {
        const {positionChange} = gestureMoveEvent

        // Apply touch input to camera rotation
        const rotationSpeed = schema.rotationSpeed * 5  // Increased sensitivity for more responsive touch

        // Update azimuth (horizontal) rotation - inverted direction
        data.azimuthAngle -= positionChange.x * rotationSpeed

        // Update polar (vertical) rotation - inverted direction
        data.polarAngle -= positionChange.y * rotationSpeed

        // Clamp polar angle: 0.1 (near top-down) to π/2 - 0.1 (just above ground level)
        data.polarAngle = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, data.polarAngle))

        // Normalize azimuth angle to [-π, π]
        while (data.azimuthAngle > Math.PI) data.azimuthAngle -= 2 * Math.PI
        while (data.azimuthAngle < -Math.PI) data.azimuthAngle += 2 * Math.PI
      }
    }

    // Handle gesture end (drag end)
    const handleGestureEnd = (e: any) => {
      const data = dataAttribute.cursor(eid)
      data.isDragging = false
    }

    // Handle vehicle controller change events
    const handleVehicleChange = (event: any) => {
      const data = dataAttribute.cursor(eid)
      // Update which controller is active
      data.activeController = event.data.controller
    }

    // Handle entity teleportation events
    const handleEntityTeleported = (event: any) => {
      const schema = customOrbitCam.get(world, eid)
      const data = dataAttribute.cursor(eid)

      // Check if the teleported entity is our target
      if (event.data.entityId === schema.target) {
        // Reset our position tracking to the new position to prevent velocity spike
        data.lastTargetPositionX = event.data.newPosition.x
        data.lastTargetPositionY = event.data.newPosition.y
        data.lastTargetPositionZ = event.data.newPosition.z

        // Reset velocity to zero to prevent auto-orientation
        data.velocityX = 0
        data.velocityZ = 0
      }
    }

    ecs.defineState('active').initial()
      .onEnter(() => {
        // Initialize camera angles and target position
        const data = dataAttribute.cursor(eid)
        data.azimuthAngle = 0
        data.polarAngle = Math.PI / 3  // Start at 60 degrees
        data.targetAzimuthAngle = 0
        data.targetPolarAngle = Math.PI / 3  // Default polar angle to snap back to
        data.activeController = 'ball'  // Default to ball controller

        // Initialize drag control data
        data.isDragging = false

        // Initialize with current target position if available
        const schema = customOrbitCam.get(world, eid)
        if (schema.target !== null) {
          const targetPos = world.transform.getWorldPosition(schema.target)
          data.lastTargetPositionX = targetPos.x
          data.lastTargetPositionY = targetPos.y
          data.lastTargetPositionZ = targetPos.z
        } else {
          data.lastTargetPositionX = 0
          data.lastTargetPositionY = 0
          data.lastTargetPositionZ = 0
        }

        // Listen for vehicle controller changes
        world.events.addListener(world.events.globalId, 'vehicle-controller-changed', handleVehicleChange)

        // Listen for entity teleportation events
        world.events.addListener(world.events.globalId, 'entity-teleported', handleEntityTeleported)
      })
      .onExit(() => {
        // Clean up event listeners
        world.events.removeListener(world.events.globalId, 'vehicle-controller-changed', handleVehicleChange)
        world.events.removeListener(world.events.globalId, 'entity-teleported', handleEntityTeleported)
      })
      .listen(world.events.globalId, ecs.input.GESTURE_START, handleGestureStart)
      .listen(world.events.globalId, ecs.input.GESTURE_MOVE, handleGestureMove)
      .listen(world.events.globalId, ecs.input.GESTURE_END, handleGestureEnd)

    dataAttribute.set(eid, {
      azimuthAngle: 0,
      polarAngle: Math.PI / 3,
      targetAzimuthAngle: 0,
      targetPolarAngle: Math.PI / 3,
      lastTargetPositionX: 0,
      lastTargetPositionY: 0,
      lastTargetPositionZ: 0,
      velocityX: 0,
      velocityZ: 0,
      isDragging: false,
      activeController: 'ball',
    })
  },
  tick: (world, component) => {
    const {eid} = component
    const schema = customOrbitCam.get(world, eid)
    const {data} = component

    // Skip if no target
    if (schema.target === null) return

    // Get target position
    const targetPos = world.transform.getWorldPosition(schema.target)

    // Calculate ball's actual velocity based on position changes
    const deltaX = targetPos.x - data.lastTargetPositionX
    const deltaZ = targetPos.z - data.lastTargetPositionZ

    // Calculate velocity (skip first frame to avoid large initial values)
    const isFirstFrame = (data.lastTargetPositionX === 0 && data.lastTargetPositionY === 0 && data.lastTargetPositionZ === 0)
    if (!isFirstFrame && world.time.delta > 0) {
      // Update velocity with some smoothing to reduce jitter
      const smoothingFactor = 0.7  // Increased smoothing for smoother velocity tracking
      data.velocityX = data.velocityX * smoothingFactor + (deltaX / world.time.delta) * (1 - smoothingFactor)
      data.velocityZ = data.velocityZ * smoothingFactor + (deltaZ / world.time.delta) * (1 - smoothingFactor)
    }

    // Calculate speed from velocity components
    const speed = Math.sqrt(data.velocityX * data.velocityX + data.velocityZ * data.velocityZ)

    // Always update target angle based on actual movement, regardless of speed
    // This ensures camera follows any movement, even slow movement
    if (speed > schema.minVelocityThreshold) {
      // Calculate angle from actual velocity - camera should be behind ball
      const velocityAngle = Math.atan2(-data.velocityX, -data.velocityZ)

      // Smoothly update target angle (no threshold - always follow movement)
      data.targetAzimuthAngle = velocityAngle
    }

    // Store current position for next frame's velocity calculation
    data.lastTargetPositionX = targetPos.x
    data.lastTargetPositionY = targetPos.y
    data.lastTargetPositionZ = targetPos.z

    // Handle look input for camera rotation
    const up = world.input.getAction('lookUp')
    const down = world.input.getAction('lookDown')
    const left = world.input.getAction('lookLeft')
    const right = world.input.getAction('lookRight')

    // Update camera angles based on look input and auto-orientation
    const rotationSpeed = schema.rotationSpeed * world.time.delta
    const autoOrientSpeed = schema.autoOrientSpeed * world.time.delta

    // Manual rotation input
    let manualRotation = 0
    if (left) {
      manualRotation -= rotationSpeed
    }
    if (right) {
      manualRotation += rotationSpeed
    }

    // Auto-orientation towards ball movement direction (only when not dragging)
    let finalRotation = manualRotation

    if (!data.isDragging) {
      // Handle horizontal (azimuth) auto-orientation
      let angleDiff = data.targetAzimuthAngle - data.azimuthAngle

      // Normalize angle difference to [-π, π] for shortest rotation path
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI

      // Calculate auto-rotation amount
      const maxAutoRotation = autoOrientSpeed
      let autoRotation = 0

      // Only auto-rotate if there's a significant angle difference
      if (Math.abs(angleDiff) > 0.01) {
        autoRotation = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), maxAutoRotation)
      }

      // Blend manual and auto rotation based on autoOrientStrength
      finalRotation = manualRotation * (1 - schema.autoOrientStrength) +
                      autoRotation * schema.autoOrientStrength

      // Handle vertical (polar) auto-orientation snap-back
      const polarDiff = data.targetPolarAngle - data.polarAngle
      let polarAutoRotation = 0

      // Only auto-rotate polar if there's a significant angle difference
      if (Math.abs(polarDiff) > 0.01) {
        polarAutoRotation = Math.sign(polarDiff) * Math.min(Math.abs(polarDiff), maxAutoRotation)
      }

      // Apply polar auto-rotation with same strength as azimuth
      const finalPolarRotation = polarAutoRotation * schema.autoOrientStrength
      data.polarAngle += finalPolarRotation
    }

    // Apply the horizontal rotation
    data.azimuthAngle += finalRotation

    // CRITICAL: Update shared camera data for the active controller
    // This ensures the controllers get the correct camera angle
    if (data.activeController === 'rocket') {
      rocketCameraData.azimuthAngle = data.azimuthAngle
    } else {
      // Default to ball controller
      ballCameraData.azimuthAngle = data.azimuthAngle
    }

    // Normalize azimuth angle to [-π, π]
    while (data.azimuthAngle > Math.PI) data.azimuthAngle -= 2 * Math.PI
    while (data.azimuthAngle < -Math.PI) data.azimuthAngle += 2 * Math.PI
    if (up) {
      data.polarAngle -= rotationSpeed
    }
    if (down) {
      data.polarAngle += rotationSpeed
    }

    // Clamp polar angle: 0.1 (near top-down) to π/2 - 0.1 (just above ground level)
    data.polarAngle = Math.max(0.1, Math.min(Math.PI / 2 - 0.1, data.polarAngle))

    // Calculate camera position based on target and angles
    const camX = targetPos.x + Math.sin(data.azimuthAngle) * Math.sin(data.polarAngle) * schema.distance
    const camY = targetPos.y + schema.height + Math.cos(data.polarAngle) * schema.distance
    const camZ = targetPos.z + Math.cos(data.azimuthAngle) * Math.sin(data.polarAngle) * schema.distance

    // Smoothly move camera to calculated position
    const currentPos = world.transform.getWorldPosition(eid)
    const lerpFactor = Math.min(1.0, schema.followSpeed * world.time.delta)

    const newX = currentPos.x + (camX - currentPos.x) * lerpFactor
    const newY = currentPos.y + (camY - currentPos.y) * lerpFactor
    const newZ = currentPos.z + (camZ - currentPos.z) * lerpFactor

    world.transform.setWorldPosition(eid, {x: newX, y: newY, z: newZ})

    // Make camera look at target
    world.transform.lookAtWorld(eid, targetPos)
  },
})

export {customOrbitCam}
